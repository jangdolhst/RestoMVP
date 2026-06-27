CREATE TABLE IF NOT EXISTS public.restaurant_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurant_profiles(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_token UUID NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone_normalized TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT restaurant_reviews_one_per_order UNIQUE (order_id),
  CONSTRAINT restaurant_reviews_one_phone_per_restaurant UNIQUE (restaurant_id, customer_phone_normalized)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_reviews_public_list
  ON public.restaurant_reviews (restaurant_id, is_hidden, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_restaurant_reviews_rating
  ON public.restaurant_reviews (restaurant_id, rating);

ALTER TABLE public.restaurant_reviews ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.restaurant_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.restaurant_reviews TO authenticated;

DROP POLICY IF EXISTS "Restaurant owners read their reviews" ON public.restaurant_reviews;
CREATE POLICY "Restaurant owners read their reviews"
  ON public.restaurant_reviews
  FOR SELECT
  TO authenticated
  USING (auth.uid() = restaurant_id);

CREATE OR REPLACE FUNCTION public.normalize_review_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
$$;

REVOKE EXECUTE ON FUNCTION public.normalize_review_phone(TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_review_eligibility(
  p_restaurant_id UUID,
  p_order_token UUID
)
RETURNS TABLE (
  eligible BOOLEAN,
  reason TEXT,
  order_id UUID,
  order_status TEXT,
  client_name TEXT,
  phone_hint TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order RECORD;
  v_phone_digits TEXT;
BEGIN
  SELECT o.id, o.status, o.client_name, o.phone, o.tenant_id
  INTO v_order
  FROM public.orders o
  WHERE o.order_token = p_order_token
  LIMIT 1;

  IF NOT FOUND OR v_order.tenant_id <> p_restaurant_id THEN
    RETURN QUERY SELECT false, 'invalid_order', NULL::UUID, NULL::TEXT, ''::TEXT, ''::TEXT;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.restaurant_reviews rr WHERE rr.order_id = v_order.id) THEN
    RETURN QUERY SELECT false, 'already_reviewed', v_order.id, v_order.status, COALESCE(v_order.client_name, ''), ''::TEXT;
    RETURN;
  END IF;

  IF v_order.status <> 'pagado' THEN
    RETURN QUERY SELECT false, 'order_not_paid', v_order.id, v_order.status, COALESCE(v_order.client_name, ''), ''::TEXT;
    RETURN;
  END IF;

  v_phone_digits := public.normalize_review_phone(v_order.phone);

  RETURN QUERY SELECT
    true,
    'eligible',
    v_order.id,
    v_order.status,
    COALESCE(v_order.client_name, ''),
    CASE
      WHEN length(v_phone_digits) >= 4 THEN repeat('*', greatest(length(v_phone_digits) - 4, 0)) || right(v_phone_digits, 4)
      ELSE ''
    END;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_restaurant_review(
  p_restaurant_id UUID,
  p_order_token UUID,
  p_customer_name TEXT,
  p_phone TEXT,
  p_rating INTEGER,
  p_comment TEXT
)
RETURNS TABLE (
  id UUID,
  restaurant_id UUID,
  customer_name TEXT,
  rating INTEGER,
  comment TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_restaurant_id UUID;
  v_order RECORD;
  v_phone_normalized TEXT;
  v_order_phone_normalized TEXT;
  v_customer_name TEXT;
  v_comment TEXT;
  v_review public.restaurant_reviews%ROWTYPE;
BEGIN
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'invalid_rating';
  END IF;

  SELECT rp.id
  INTO v_restaurant_id
  FROM public.restaurant_profiles rp
  WHERE rp.id = p_restaurant_id
    AND rp.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_restaurant';
  END IF;

  SELECT o.id, o.tenant_id, o.order_token, o.status, o.client_name, o.phone
  INTO v_order
  FROM public.orders o
  WHERE o.order_token = p_order_token
  LIMIT 1;

  IF NOT FOUND OR v_order.tenant_id <> p_restaurant_id THEN
    RAISE EXCEPTION 'invalid_order';
  END IF;

  IF v_order.status <> 'pagado' THEN
    RAISE EXCEPTION 'order_not_paid';
  END IF;

  v_phone_normalized := public.normalize_review_phone(p_phone);
  v_order_phone_normalized := public.normalize_review_phone(v_order.phone);

  IF length(v_phone_normalized) < 8 OR v_phone_normalized <> v_order_phone_normalized THEN
    RAISE EXCEPTION 'phone_mismatch';
  END IF;

  IF EXISTS (SELECT 1 FROM public.restaurant_reviews rr WHERE rr.order_id = v_order.id) THEN
    RAISE EXCEPTION 'already_reviewed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.restaurant_reviews rr
    WHERE rr.restaurant_id = p_restaurant_id
      AND rr.customer_phone_normalized = v_phone_normalized
  ) THEN
    RAISE EXCEPTION 'already_reviewed';
  END IF;

  v_customer_name := left(trim(COALESCE(NULLIF(p_customer_name, ''), v_order.client_name, 'Cliente')), 80);
  v_comment := left(trim(COALESCE(p_comment, '')), 800);

  INSERT INTO public.restaurant_reviews (
    restaurant_id,
    order_id,
    order_token,
    customer_name,
    customer_phone_normalized,
    rating,
    comment
  ) VALUES (
    p_restaurant_id,
    v_order.id,
    p_order_token,
    v_customer_name,
    v_phone_normalized,
    p_rating,
    v_comment
  )
  RETURNING * INTO v_review;

  RETURN QUERY SELECT
    v_review.id,
    v_review.restaurant_id,
    v_review.customer_name,
    v_review.rating,
    v_review.comment,
    v_review.created_at;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'already_reviewed';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_restaurant_reviews(
  p_restaurant_id UUID,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  restaurant_id UUID,
  customer_name TEXT,
  rating INTEGER,
  comment TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    rr.id,
    rr.restaurant_id,
    rr.customer_name,
    rr.rating,
    rr.comment,
    rr.created_at
  FROM public.restaurant_reviews rr
  JOIN public.restaurant_profiles rp ON rp.id = rr.restaurant_id
  WHERE rr.restaurant_id = p_restaurant_id
    AND rr.is_hidden = false
    AND rp.is_active = true
  ORDER BY rr.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 100);
$$;

CREATE OR REPLACE FUNCTION public.get_restaurant_review_summary(
  p_restaurant_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  restaurant_id UUID,
  average_rating NUMERIC,
  review_count INTEGER,
  five_star_count INTEGER,
  four_star_count INTEGER,
  three_star_count INTEGER,
  two_star_count INTEGER,
  one_star_count INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    rr.restaurant_id,
    ROUND(AVG(rr.rating)::numeric, 1) AS average_rating,
    COUNT(*)::integer AS review_count,
    COUNT(*) FILTER (WHERE rr.rating = 5)::integer AS five_star_count,
    COUNT(*) FILTER (WHERE rr.rating = 4)::integer AS four_star_count,
    COUNT(*) FILTER (WHERE rr.rating = 3)::integer AS three_star_count,
    COUNT(*) FILTER (WHERE rr.rating = 2)::integer AS two_star_count,
    COUNT(*) FILTER (WHERE rr.rating = 1)::integer AS one_star_count
  FROM public.restaurant_reviews rr
  JOIN public.restaurant_profiles rp ON rp.id = rr.restaurant_id
  WHERE rr.is_hidden = false
    AND rp.is_active = true
    AND (p_restaurant_ids IS NULL OR rr.restaurant_id = ANY(p_restaurant_ids))
  GROUP BY rr.restaurant_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_review_eligibility(UUID, UUID) FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_restaurant_review(UUID, UUID, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_restaurant_reviews(UUID, INTEGER) FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_restaurant_review_summary(UUID[]) FROM PUBLIC, authenticated;

GRANT EXECUTE ON FUNCTION public.get_review_eligibility(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.create_restaurant_review(UUID, UUID, TEXT, TEXT, INTEGER, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_restaurant_reviews(UUID, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.get_restaurant_review_summary(UUID[]) TO anon;
