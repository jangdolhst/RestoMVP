-- Migración: order_token + RPC para seguimiento de pedidos
-- Fecha: 2026-05-17
-- Descripción: Agrega token secreto a órdenes para que clientes sin sesión
--              puedan rastrear sus pedidos. RPC segura devuelve solo campos públicos.

-- 1. Columna order_token
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_token UUID DEFAULT gen_random_uuid();
UPDATE orders SET order_token = gen_random_uuid() WHERE order_token IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_order_token ON orders (order_token);

-- 2. RPC: get_orders_by_tokens
CREATE OR REPLACE FUNCTION get_orders_by_tokens(tokens UUID[])
RETURNS TABLE (
  id UUID,
  order_number INTEGER,
  client_name TEXT,
  status TEXT,
  total NUMERIC,
  created_at TIMESTAMPTZ,
  order_token UUID,
  restaurant_name TEXT,
  items JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'product_name', oi.product_name,
        'quantity', oi.quantity,
        'price', oi.price
      ))
      FROM order_items oi WHERE oi.order_id = o.id),
      '[]'::jsonb
    ) AS items
  FROM orders o
  LEFT JOIN restaurant_profiles rp ON rp.id = o.tenant_id
  WHERE o.order_token = ANY(tokens)
  ORDER BY o.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_orders_by_tokens(UUID[]) TO anon, authenticated;
