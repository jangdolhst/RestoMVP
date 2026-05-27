-- Migracion: validaciones extra para RPC publico de pedidos
-- Fecha: 2026-05-26

CREATE OR REPLACE FUNCTION public.create_public_order(
  p_tenant_id UUID,
  p_client_name TEXT,
  p_phone TEXT,
  p_items JSONB
)
RETURNS TABLE (
  id UUID,
  order_number INTEGER,
  order_token UUID,
  confirmation_code TEXT,
  total NUMERIC,
  restaurant_phone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_restaurant_phone TEXT;
  v_order_id UUID;
  v_order_number INTEGER;
  v_order_token UUID := gen_random_uuid();
  v_confirmation_code TEXT;
  v_clean_phone TEXT;
  v_total NUMERIC := 0;
  v_item JSONB;
  v_product RECORD;
  v_quantity INTEGER;
  v_mods JSONB;
  v_mod JSONB;
  v_mod_name TEXT;
  v_clean_mods JSONB;
  v_extra RECORD;
  v_extra_total NUMERIC;
  v_items_payload JSONB := '[]'::jsonb;
  v_item_count INTEGER;
  v_chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
BEGIN
  SELECT rp.phone
  INTO v_restaurant_phone
  FROM public.restaurant_profiles rp
  WHERE rp.id = p_tenant_id
    AND rp.is_active = true
    AND COALESCE((rp.business_hours->>'is_manually_closed')::boolean, false) = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'restaurant_not_available';
  END IF;

  v_clean_phone := left(trim(COALESCE(p_phone, '')), 32);
  IF length(regexp_replace(v_clean_phone, '[^0-9]', '', 'g')) < 8 THEN
    RAISE EXCEPTION 'invalid_phone';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.tenant_id = p_tenant_id
      AND o.phone = v_clean_phone
      AND o.created_at >= (NOW() - INTERVAL '15 seconds')
  ) THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'invalid_items';
  END IF;

  v_item_count := jsonb_array_length(p_items);
  IF v_item_count < 1 OR v_item_count > 50 THEN
    RAISE EXCEPTION 'invalid_item_count';
  END IF;

  SELECT string_agg(substr(v_chars, (floor(random() * length(v_chars)) + 1)::integer, 1), '')
  INTO v_confirmation_code
  FROM generate_series(1, 4);

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    SELECT p.id, p.name, p.price, p.ingredients
    INTO v_product
    FROM public.products p
    WHERE p.id = (v_item->>'product_id')::uuid
      AND p.tenant_id = p_tenant_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'invalid_product';
    END IF;

    v_quantity := LEAST(99, GREATEST(1, COALESCE(NULLIF(v_item->>'quantity', '')::integer, 1)));
    v_mods := COALESCE(v_item->'modifications', '[]'::jsonb);
    IF jsonb_typeof(v_mods) <> 'array' THEN
      v_mods := '[]'::jsonb;
    END IF;

    v_clean_mods := '[]'::jsonb;
    v_extra_total := 0;

    FOR v_mod IN
      SELECT value
      FROM jsonb_array_elements(v_mods) WITH ORDINALITY AS mods(value, ord)
      WHERE ord <= 20
    LOOP
      v_mod_name := left(trim(COALESCE(v_mod->>'name', '')), 80);
      IF v_mod_name = '' THEN
        CONTINUE;
      END IF;

      IF v_mod->>'type' = 'extra' THEN
        SELECT e.name, e.price
        INTO v_extra
        FROM public.extras e
        WHERE e.tenant_id = p_tenant_id
          AND lower(e.name) = lower(v_mod_name)
        ORDER BY e.created_at DESC
        LIMIT 1;

        IF FOUND THEN
          v_extra_total := v_extra_total + COALESCE(v_extra.price, 0);
          v_clean_mods := v_clean_mods || jsonb_build_array(jsonb_build_object(
            'type', 'extra',
            'name', v_extra.name,
            'price', v_extra.price
          ));
        END IF;
      ELSIF v_mod->>'type' = 'remove' THEN
        v_clean_mods := v_clean_mods || jsonb_build_array(jsonb_build_object(
          'type', 'remove',
          'name', v_mod_name,
          'price', 0
        ));
      END IF;
    END LOOP;

    v_total := v_total + ((COALESCE(v_product.price, 0) + v_extra_total) * v_quantity);
    v_items_payload := v_items_payload || jsonb_build_array(jsonb_build_object(
      'product_name', v_product.name,
      'quantity', v_quantity,
      'price', v_product.price,
      'ingredients', v_product.ingredients,
      'modifications', v_clean_mods
    ));
  END LOOP;

  INSERT INTO public.orders (
    tenant_id,
    client_name,
    table_name,
    phone,
    type,
    total,
    status,
    confirmation_code,
    order_token
  )
  VALUES (
    p_tenant_id,
    left(trim(COALESCE(p_client_name, 'Sin Nombre')), 80),
    'Online',
    v_clean_phone,
    'online',
    v_total,
    'pendiente_confirmacion',
    v_confirmation_code,
    v_order_token
  )
  RETURNING orders.id, orders.order_number
  INTO v_order_id, v_order_number;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items_payload)
  LOOP
    INSERT INTO public.order_items (
      order_id,
      product_name,
      quantity,
      price,
      ingredients,
      modifications
    )
    VALUES (
      v_order_id,
      v_item->>'product_name',
      (v_item->>'quantity')::integer,
      (v_item->>'price')::numeric,
      v_item->>'ingredients',
      v_item->'modifications'
    );
  END LOOP;

  RETURN QUERY SELECT
    v_order_id,
    v_order_number,
    v_order_token,
    v_confirmation_code,
    v_total,
    COALESCE(v_restaurant_phone, '');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_public_order(UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_public_order(UUID, TEXT, TEXT, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_order(UUID, TEXT, TEXT, JSONB) TO anon;
