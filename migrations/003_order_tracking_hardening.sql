-- Migración: hardening de seguimiento de pedidos anónimos
-- Fecha: 2026-05-22
-- Objetivo:
--   1) Mantener flujo sin cuenta para clientes (tracking por token).
--   2) Reducir superficie de abuso del RPC público.
--   3) Mantener campos necesarios para UX (nombre/dirección/coordenadas del restaurante).

-- Reemplazo seguro del RPC de tracking
CREATE OR REPLACE FUNCTION public.get_orders_by_tokens(tokens UUID[])
RETURNS TABLE (
  id UUID,
  order_number INTEGER,
  client_name TEXT,
  status TEXT,
  total NUMERIC,
  created_at TIMESTAMPTZ,
  order_token UUID,
  restaurant_name TEXT,
  restaurant_address TEXT,
  restaurant_latitude NUMERIC,
  restaurant_longitude NUMERIC,
  items JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  safe_tokens UUID[];
BEGIN
  -- Normalizar entrada:
  -- - elimina NULLs
  -- - deduplica
  -- - limita a 20 tokens por request
  SELECT COALESCE(array_agg(DISTINCT tkn), '{}'::UUID[])
  INTO safe_tokens
  FROM (
    SELECT tkn
    FROM unnest(COALESCE(tokens, '{}'::UUID[])) AS tkn
    WHERE tkn IS NOT NULL
    LIMIT 20
  ) limited_tokens;

  -- Evitar trabajo innecesario si no hay tokens válidos
  IF COALESCE(array_length(safe_tokens, 1), 0) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.order_number,
    o.client_name,
    o.status,
    o.total,
    o.created_at,
    o.order_token,
    COALESCE(rp.name, '') AS restaurant_name,
    COALESCE(rp.address, '') AS restaurant_address,
    rp.latitude AS restaurant_latitude,
    rp.longitude AS restaurant_longitude,
    COALESCE(oi.items, '[]'::jsonb) AS items
  FROM public.orders o
  LEFT JOIN public.restaurant_profiles rp ON rp.id = o.tenant_id
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'product_name', i.product_name,
        'quantity', i.quantity,
        'price', i.price
      )
    ) AS items
    FROM public.order_items i
    WHERE i.order_id = o.id
  ) oi ON TRUE
  WHERE o.order_token = ANY(safe_tokens)
    -- Limita exposición histórica de tokens filtrados/exfiltrados.
    AND o.created_at >= (NOW() - INTERVAL '7 days')
  ORDER BY o.created_at DESC
  LIMIT 50;
END;
$$;

-- Endurecer permisos: evitar ejecución por rol PUBLIC global.
REVOKE EXECUTE ON FUNCTION public.get_orders_by_tokens(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_orders_by_tokens(UUID[]) TO anon;
