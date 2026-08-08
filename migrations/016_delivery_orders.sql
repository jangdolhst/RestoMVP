BEGIN;

ALTER TABLE public.restaurant_profiles
  ADD COLUMN IF NOT EXISTS delivery_service_mode TEXT NOT NULL DEFAULT 'pickup_only',
  ADD COLUMN IF NOT EXISTS delivery_fee_mode TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS delivery_fixed_fee_mxn NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_base_fee_mxn NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_fee_per_km_mxn NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_max_distance_km NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS delivery_min_order_mxn NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS delivery_eta_min_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS delivery_eta_max_minutes INTEGER;

ALTER TABLE public.restaurant_profiles
  DROP CONSTRAINT IF EXISTS restaurant_profiles_delivery_service_mode_valid,
  ADD CONSTRAINT restaurant_profiles_delivery_service_mode_valid CHECK (
    delivery_service_mode IN ('pickup_only', 'delivery_only', 'pickup_and_delivery')
  );

ALTER TABLE public.restaurant_profiles
  DROP CONSTRAINT IF EXISTS restaurant_profiles_delivery_fee_mode_valid,
  ADD CONSTRAINT restaurant_profiles_delivery_fee_mode_valid CHECK (
    delivery_fee_mode IN ('free', 'fixed', 'per_km', 'manual')
  );

ALTER TABLE public.restaurant_profiles
  DROP CONSTRAINT IF EXISTS restaurant_profiles_delivery_amounts_valid,
  ADD CONSTRAINT restaurant_profiles_delivery_amounts_valid CHECK (
    delivery_fixed_fee_mxn >= 0
    AND delivery_base_fee_mxn >= 0
    AND delivery_fee_per_km_mxn >= 0
    AND (delivery_max_distance_km IS NULL OR delivery_max_distance_km >= 0)
    AND (delivery_min_order_mxn IS NULL OR delivery_min_order_mxn >= 0)
    AND (delivery_eta_min_minutes IS NULL OR delivery_eta_min_minutes >= 0)
    AND (delivery_eta_max_minutes IS NULL OR delivery_eta_max_minutes >= 0)
    AND (delivery_eta_min_minutes IS NULL OR delivery_eta_max_minutes IS NULL OR delivery_eta_max_minutes >= delivery_eta_min_minutes)
  );

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfillment_type TEXT NOT NULL DEFAULT 'pickup',
  ADD COLUMN IF NOT EXISTS delivery_address TEXT,
  ADD COLUMN IF NOT EXISTS delivery_reference TEXT,
  ADD COLUMN IF NOT EXISTS delivery_latitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS delivery_longitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS delivery_distance_km NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS delivery_fee_mxn NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_fee_status TEXT NOT NULL DEFAULT 'not_applicable',
  ADD COLUMN IF NOT EXISTS delivery_fee_note TEXT;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_fulfillment_type_valid,
  ADD CONSTRAINT orders_fulfillment_type_valid CHECK (fulfillment_type IN ('pickup', 'delivery'));

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_delivery_fee_status_valid,
  ADD CONSTRAINT orders_delivery_fee_status_valid CHECK (delivery_fee_status IN ('not_applicable', 'pending_manual', 'confirmed'));

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_delivery_values_valid,
  ADD CONSTRAINT orders_delivery_values_valid CHECK (
    delivery_fee_mxn >= 0
    AND (delivery_distance_km IS NULL OR delivery_distance_km >= 0)
    AND (delivery_latitude IS NULL OR delivery_latitude BETWEEN -90 AND 90)
    AND (delivery_longitude IS NULL OR delivery_longitude BETWEEN -180 AND 180)
  );

CREATE INDEX IF NOT EXISTS idx_orders_tenant_fulfillment_status
  ON public.orders (tenant_id, fulfillment_type, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_categories_tenant_id
  ON public.categories (tenant_id);

CREATE INDEX IF NOT EXISTS idx_extras_tenant_id
  ON public.extras (tenant_id);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON public.order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_products_category_id
  ON public.products (category_id);

CREATE INDEX IF NOT EXISTS idx_products_tenant_id
  ON public.products (tenant_id);

GRANT UPDATE (
  delivery_service_mode,
  delivery_fee_mode,
  delivery_fixed_fee_mxn,
  delivery_base_fee_mxn,
  delivery_fee_per_km_mxn,
  delivery_max_distance_km,
  delivery_min_order_mxn,
  delivery_eta_min_minutes,
  delivery_eta_max_minutes,
  updated_at
)
ON TABLE public.restaurant_profiles
TO authenticated;

GRANT INSERT (
  id,
  name,
  description,
  logo_url,
  banner_url,
  address,
  phone,
  categories,
  is_active,
  latitude,
  longitude,
  table_count,
  waiters,
  business_hours,
  delivery_service_mode,
  delivery_fee_mode,
  delivery_fixed_fee_mxn,
  delivery_base_fee_mxn,
  delivery_fee_per_km_mxn,
  delivery_max_distance_km,
  delivery_min_order_mxn,
  delivery_eta_min_minutes,
  delivery_eta_max_minutes,
  updated_at
)
ON TABLE public.restaurant_profiles
TO authenticated;

DROP FUNCTION IF EXISTS public.create_public_order(UUID, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.create_public_order(
  p_tenant_id UUID,
  p_client_name TEXT,
  p_phone TEXT,
  p_items JSONB,
  p_fulfillment_type TEXT DEFAULT 'pickup',
  p_delivery_address TEXT DEFAULT NULL,
  p_delivery_reference TEXT DEFAULT NULL,
  p_delivery_latitude NUMERIC DEFAULT NULL,
  p_delivery_longitude NUMERIC DEFAULT NULL
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
  v_profile RECORD;
  v_order_id UUID;
  v_order_number INTEGER;
  v_order_token UUID := gen_random_uuid();
  v_confirmation_code TEXT;
  v_clean_phone TEXT;
  v_total NUMERIC := 0;
  v_items_total NUMERIC := 0;
  v_delivery_fee_mxn NUMERIC := 0;
  v_delivery_distance_km NUMERIC := NULL;
  v_delivery_fee_status TEXT := 'not_applicable';
  v_delivery_fee_note TEXT := NULL;
  v_fulfillment_type TEXT := lower(trim(COALESCE(p_fulfillment_type, 'pickup')));
  v_clean_delivery_address TEXT := left(trim(COALESCE(p_delivery_address, '')), 300);
  v_clean_delivery_reference TEXT := left(trim(COALESCE(p_delivery_reference, '')), 300);
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
  SELECT
    rp.phone,
    rp.latitude,
    rp.longitude,
    rp.delivery_service_mode,
    rp.delivery_fee_mode,
    rp.delivery_fixed_fee_mxn,
    rp.delivery_base_fee_mxn,
    rp.delivery_fee_per_km_mxn,
    rp.delivery_max_distance_km,
    rp.delivery_min_order_mxn
  INTO v_profile
  FROM public.restaurant_profiles rp
  WHERE rp.id = p_tenant_id
    AND rp.is_active = true
    AND COALESCE((rp.business_hours->>'is_manually_closed')::boolean, false) = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'restaurant_not_available';
  END IF;

  IF v_fulfillment_type NOT IN ('pickup', 'delivery') THEN
    RAISE EXCEPTION 'invalid_fulfillment_type';
  END IF;

  IF v_fulfillment_type = 'delivery' AND v_profile.delivery_service_mode = 'pickup_only' THEN
    RAISE EXCEPTION 'delivery_unavailable';
  END IF;

  IF v_fulfillment_type = 'pickup' AND v_profile.delivery_service_mode = 'delivery_only' THEN
    RAISE EXCEPTION 'pickup_unavailable';
  END IF;

  IF v_fulfillment_type = 'delivery' AND v_clean_delivery_address = '' THEN
    RAISE EXCEPTION 'delivery_address_required';
  END IF;

  IF p_delivery_latitude IS NOT NULL AND (p_delivery_latitude < -90 OR p_delivery_latitude > 90) THEN
    RAISE EXCEPTION 'invalid_delivery_coordinates';
  END IF;

  IF p_delivery_longitude IS NOT NULL AND (p_delivery_longitude < -180 OR p_delivery_longitude > 180) THEN
    RAISE EXCEPTION 'invalid_delivery_coordinates';
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

    v_items_total := v_items_total + ((COALESCE(v_product.price, 0) + v_extra_total) * v_quantity);
    v_items_payload := v_items_payload || jsonb_build_array(jsonb_build_object(
      'product_name', v_product.name,
      'quantity', v_quantity,
      'price', v_product.price,
      'ingredients', v_product.ingredients,
      'modifications', v_clean_mods
    ));
  END LOOP;

  v_items_total := ROUND(v_items_total::NUMERIC, 2);
  v_total := v_items_total;

  IF v_fulfillment_type = 'delivery' THEN
    IF v_profile.delivery_min_order_mxn IS NOT NULL AND v_items_total < v_profile.delivery_min_order_mxn THEN
      RAISE EXCEPTION 'delivery_min_order_not_met';
    END IF;

    IF v_profile.delivery_fee_mode = 'per_km'
      OR v_profile.delivery_max_distance_km IS NOT NULL THEN
      IF v_profile.latitude IS NULL OR v_profile.longitude IS NULL
        OR p_delivery_latitude IS NULL OR p_delivery_longitude IS NULL THEN
        RAISE EXCEPTION 'delivery_coordinates_required';
      END IF;

      v_delivery_distance_km := ROUND((
        6371 * 2 * asin(sqrt(
          power(sin(radians((p_delivery_latitude - v_profile.latitude) / 2)), 2)
          + cos(radians(v_profile.latitude))
          * cos(radians(p_delivery_latitude))
          * power(sin(radians((p_delivery_longitude - v_profile.longitude) / 2)), 2)
        ))
      )::NUMERIC, 2);

      IF v_profile.delivery_max_distance_km IS NOT NULL
        AND v_delivery_distance_km > v_profile.delivery_max_distance_km THEN
        RAISE EXCEPTION 'outside_delivery_radius';
      END IF;
    END IF;

    IF v_profile.delivery_fee_mode = 'free' THEN
      v_delivery_fee_mxn := 0;
      v_delivery_fee_status := 'confirmed';
    ELSIF v_profile.delivery_fee_mode = 'fixed' THEN
      v_delivery_fee_mxn := ROUND(GREATEST(COALESCE(v_profile.delivery_fixed_fee_mxn, 0), 0)::NUMERIC, 2);
      v_delivery_fee_status := 'confirmed';
    ELSIF v_profile.delivery_fee_mode = 'per_km' THEN
      IF v_delivery_distance_km IS NULL THEN
        RAISE EXCEPTION 'delivery_coordinates_required';
      END IF;
      v_delivery_fee_mxn := ROUND((
        GREATEST(COALESCE(v_profile.delivery_base_fee_mxn, 0), 0)
        + (GREATEST(COALESCE(v_profile.delivery_fee_per_km_mxn, 0), 0) * v_delivery_distance_km)
      )::NUMERIC, 2);
      v_delivery_fee_status := 'confirmed';
    ELSE
      v_delivery_fee_mxn := 0;
      v_delivery_fee_status := 'pending_manual';
      v_delivery_fee_note := 'manual_fee_required';
    END IF;

    v_total := ROUND((v_items_total + v_delivery_fee_mxn)::NUMERIC, 2);
  END IF;

  INSERT INTO public.orders (
    tenant_id,
    client_name,
    table_name,
    phone,
    type,
    total,
    status,
    confirmation_code,
    order_token,
    fulfillment_type,
    delivery_address,
    delivery_reference,
    delivery_latitude,
    delivery_longitude,
    delivery_distance_km,
    delivery_fee_mxn,
    delivery_fee_status,
    delivery_fee_note
  )
  VALUES (
    p_tenant_id,
    left(trim(COALESCE(p_client_name, 'Sin Nombre')), 80),
    CASE WHEN v_fulfillment_type = 'delivery' THEN 'Domicilio' ELSE 'Online' END,
    v_clean_phone,
    'online',
    v_total,
    'pendiente_confirmacion',
    v_confirmation_code,
    v_order_token,
    v_fulfillment_type,
    CASE WHEN v_fulfillment_type = 'delivery' THEN v_clean_delivery_address ELSE NULL END,
    CASE WHEN v_fulfillment_type = 'delivery' AND v_clean_delivery_reference <> '' THEN v_clean_delivery_reference ELSE NULL END,
    CASE WHEN v_fulfillment_type = 'delivery' THEN p_delivery_latitude ELSE NULL END,
    CASE WHEN v_fulfillment_type = 'delivery' THEN p_delivery_longitude ELSE NULL END,
    CASE WHEN v_fulfillment_type = 'delivery' THEN v_delivery_distance_km ELSE NULL END,
    CASE WHEN v_fulfillment_type = 'delivery' THEN v_delivery_fee_mxn ELSE 0 END,
    CASE WHEN v_fulfillment_type = 'delivery' THEN v_delivery_fee_status ELSE 'not_applicable' END,
    v_delivery_fee_note
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
    COALESCE(v_profile.phone, '');
END;
$$;

CREATE OR REPLACE FUNCTION public.set_manual_delivery_fee(p_order_id UUID, p_delivery_fee_mxn NUMERIC)
RETURNS TABLE (
  id UUID,
  total NUMERIC,
  delivery_fee_mxn NUMERIC,
  delivery_fee_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order RECORD;
  v_fee NUMERIC(10,2);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_delivery_fee_mxn IS NULL OR p_delivery_fee_mxn < 0 THEN
    RAISE EXCEPTION 'Delivery fee must be non-negative' USING ERRCODE = '22003';
  END IF;

  SELECT o.id, o.tenant_id, o.total, o.fulfillment_type, o.delivery_fee_status, o.delivery_fee_mxn
  INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
  END IF;

  IF auth.uid() <> v_order.tenant_id THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_order.fulfillment_type <> 'delivery' OR v_order.delivery_fee_status <> 'pending_manual' THEN
    RAISE EXCEPTION 'Manual delivery fee is not pending' USING ERRCODE = 'P0001';
  END IF;

  v_fee := ROUND(p_delivery_fee_mxn::NUMERIC, 2);

  UPDATE public.orders o
  SET
    delivery_fee_mxn = v_fee,
    delivery_fee_status = 'confirmed',
    delivery_fee_note = NULL,
    total = ROUND((COALESCE(o.total, 0) - COALESCE(o.delivery_fee_mxn, 0) + v_fee)::NUMERIC, 2)
  WHERE o.id = v_order.id
  RETURNING o.id, o.total, o.delivery_fee_mxn, o.delivery_fee_status
  INTO id, total, delivery_fee_mxn, delivery_fee_status;

  RETURN NEXT;
END;
$$;

DROP FUNCTION IF EXISTS public.get_orders_by_tokens(UUID[]);

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
  fulfillment_type TEXT,
  delivery_address TEXT,
  delivery_reference TEXT,
  delivery_distance_km NUMERIC,
  delivery_fee_mxn NUMERIC,
  delivery_fee_status TEXT,
  delivery_fee_note TEXT,
  items JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  safe_tokens UUID[];
BEGIN
  SELECT COALESCE(array_agg(DISTINCT tkn), '{}'::UUID[])
  INTO safe_tokens
  FROM (
    SELECT tkn
    FROM unnest(COALESCE(tokens, '{}'::UUID[])) AS tkn
    WHERE tkn IS NOT NULL
    LIMIT 20
  ) limited_tokens;

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
    o.fulfillment_type,
    o.delivery_address,
    o.delivery_reference,
    o.delivery_distance_km,
    o.delivery_fee_mxn,
    o.delivery_fee_status,
    o.delivery_fee_note,
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
    AND o.created_at >= (NOW() - INTERVAL '7 days')
  ORDER BY o.created_at DESC
  LIMIT 50;
END;
$$;

CREATE OR REPLACE FUNCTION public.capture_order_payment(
  p_order_id UUID,
  p_cash_mxn_received NUMERIC DEFAULT 0,
  p_cash_usd_received NUMERIC DEFAULT 0,
  p_card_mxn_amount NUMERIC DEFAULT 0,
  p_transfer_mxn_amount NUMERIC DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  status TEXT,
  paid_at TIMESTAMPTZ,
  payment_cash_mxn_received NUMERIC,
  payment_cash_usd_received NUMERIC,
  payment_card_mxn_amount NUMERIC,
  payment_transfer_mxn_amount NUMERIC,
  payment_exchange_rate NUMERIC,
  payment_change_mxn NUMERIC,
  payment_total_effective_mxn NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order RECORD;
  v_profile RECORD;
  v_order_total NUMERIC(12,2);
  v_exchange_rate NUMERIC(12,4);
  v_cash_mxn NUMERIC(12,2);
  v_cash_usd NUMERIC(12,2);
  v_card NUMERIC(12,2);
  v_transfer NUMERIC(12,2);
  v_usd_equivalent_mxn NUMERIC(12,2);
  v_total_received_mxn NUMERIC(12,2);
  v_change_mxn NUMERIC(12,2);
  v_effective_paid_mxn NUMERIC(12,2);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT o.id, o.tenant_id, o.total, o.status, o.delivery_fee_status
  INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
  END IF;

  IF auth.uid() <> v_order.tenant_id THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_order.status NOT IN ('pendiente_cocina', 'listo', 'en_entrega', 'entregado') THEN
    RAISE EXCEPTION 'Order cannot be paid from current status' USING ERRCODE = 'P0001';
  END IF;

  IF v_order.delivery_fee_status = 'pending_manual' THEN
    RAISE EXCEPTION 'Manual delivery fee must be confirmed before payment' USING ERRCODE = 'P0001';
  END IF;

  SELECT rp.accepts_usd, rp.usd_exchange_rate
  INTO v_profile
  FROM public.restaurant_profiles rp
  WHERE rp.id = v_order.tenant_id;

  v_order_total := ROUND(COALESCE(v_order.total, 0)::NUMERIC, 2);
  v_cash_mxn := ROUND(GREATEST(COALESCE(p_cash_mxn_received, 0), 0)::NUMERIC, 2);
  v_cash_usd := ROUND(GREATEST(COALESCE(p_cash_usd_received, 0), 0)::NUMERIC, 2);
  v_card := ROUND(GREATEST(COALESCE(p_card_mxn_amount, 0), 0)::NUMERIC, 2);
  v_transfer := ROUND(GREATEST(COALESCE(p_transfer_mxn_amount, 0), 0)::NUMERIC, 2);

  IF COALESCE(p_cash_mxn_received, 0) < 0
    OR COALESCE(p_cash_usd_received, 0) < 0
    OR COALESCE(p_card_mxn_amount, 0) < 0
    OR COALESCE(p_transfer_mxn_amount, 0) < 0 THEN
    RAISE EXCEPTION 'Negative payment values are not allowed' USING ERRCODE = '22003';
  END IF;

  IF v_cash_mxn + v_cash_usd + v_card + v_transfer <= 0 THEN
    RAISE EXCEPTION 'Payment amount required' USING ERRCODE = '22003';
  END IF;

  IF p_cash_usd_received > 0 AND NOT COALESCE(v_profile.accepts_usd, false) THEN
    RAISE EXCEPTION 'USD payments are disabled' USING ERRCODE = '42501';
  END IF;

  IF v_cash_usd > 0 AND COALESCE(v_profile.usd_exchange_rate, 0) <= 0 THEN
    RAISE EXCEPTION 'Valid USD exchange rate required' USING ERRCODE = '22003';
  END IF;

  v_exchange_rate := CASE WHEN v_cash_usd > 0 THEN v_profile.usd_exchange_rate ELSE NULL END;
  v_usd_equivalent_mxn := ROUND((v_cash_usd * COALESCE(v_exchange_rate, 0))::NUMERIC, 2);
  v_total_received_mxn := ROUND((v_cash_mxn + v_usd_equivalent_mxn + v_card + v_transfer)::NUMERIC, 2);
  v_change_mxn := GREATEST(ROUND((v_total_received_mxn - v_order_total)::NUMERIC, 2), 0);
  v_effective_paid_mxn := ROUND((v_total_received_mxn - v_change_mxn)::NUMERIC, 2);

  IF v_effective_paid_mxn <> v_order_total THEN
    RAISE EXCEPTION 'Payment does not cover order total' USING ERRCODE = '22003';
  END IF;

  UPDATE public.orders o
  SET
    status = 'pagado',
    paid_at = NOW(),
    payment_cash_mxn_received = v_cash_mxn,
    payment_cash_usd_received = v_cash_usd,
    payment_card_mxn_amount = v_card,
    payment_transfer_mxn_amount = v_transfer,
    payment_exchange_rate = v_exchange_rate,
    payment_change_mxn = v_change_mxn,
    payment_total_effective_mxn = v_effective_paid_mxn
  WHERE o.id = v_order.id
  RETURNING
    o.id,
    o.status,
    o.paid_at,
    o.payment_cash_mxn_received,
    o.payment_cash_usd_received,
    o.payment_card_mxn_amount,
    o.payment_transfer_mxn_amount,
    o.payment_exchange_rate,
    o.payment_change_mxn,
    o.payment_total_effective_mxn
  INTO
    id,
    status,
    paid_at,
    payment_cash_mxn_received,
    payment_cash_usd_received,
    payment_card_mxn_amount,
    payment_transfer_mxn_amount,
    payment_exchange_rate,
    payment_change_mxn,
    payment_total_effective_mxn;

  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_public_order(UUID, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, NUMERIC, NUMERIC) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_order(UUID, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, NUMERIC, NUMERIC) TO anon;

REVOKE EXECUTE ON FUNCTION public.set_manual_delivery_fee(UUID, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_manual_delivery_fee(UUID, NUMERIC) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_orders_by_tokens(UUID[]) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.get_orders_by_tokens(UUID[]) TO anon;

REVOKE EXECUTE ON FUNCTION public.capture_order_payment(UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.capture_order_payment(UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
