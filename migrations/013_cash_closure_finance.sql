BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_cash_mxn_received NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_cash_usd_received NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_card_mxn_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_transfer_mxn_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_exchange_rate NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS payment_change_mxn NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_total_effective_mxn NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_amounts_non_negative,
  ADD CONSTRAINT orders_payment_amounts_non_negative CHECK (
    payment_cash_mxn_received >= 0
    AND payment_cash_usd_received >= 0
    AND payment_card_mxn_amount >= 0
    AND payment_transfer_mxn_amount >= 0
    AND payment_change_mxn >= 0
    AND payment_total_effective_mxn >= 0
    AND (payment_exchange_rate IS NULL OR payment_exchange_rate > 0)
  );

ALTER TABLE public.restaurant_profiles
  ADD COLUMN IF NOT EXISTS accepts_usd BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS usd_exchange_rate NUMERIC(12,4);

ALTER TABLE public.restaurant_profiles
  DROP CONSTRAINT IF EXISTS restaurant_profiles_usd_exchange_rate_valid,
  ADD CONSTRAINT restaurant_profiles_usd_exchange_rate_valid CHECK (
    accepts_usd = false
    OR (usd_exchange_rate IS NOT NULL AND usd_exchange_rate > 0)
  );

GRANT UPDATE (accepts_usd, usd_exchange_rate, updated_at)
ON TABLE public.restaurant_profiles
TO authenticated;

CREATE TABLE IF NOT EXISTS public.cash_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.restaurant_profiles(id) ON DELETE CASCADE,
  business_date DATE NOT NULL,
  opening_cash_mxn NUMERIC(12,2) NOT NULL DEFAULT 0,
  opening_cash_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  counted_cash_mxn NUMERIC(12,2),
  counted_cash_usd NUMERIC(12,2),
  cash_expenses_mxn NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  snapshot_total_sales_mxn NUMERIC(12,2) NOT NULL DEFAULT 0,
  snapshot_paid_order_count INTEGER NOT NULL DEFAULT 0,
  snapshot_cancelled_order_count INTEGER NOT NULL DEFAULT 0,
  snapshot_cash_mxn_received NUMERIC(12,2) NOT NULL DEFAULT 0,
  snapshot_cash_usd_received NUMERIC(12,2) NOT NULL DEFAULT 0,
  snapshot_card_mxn_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  snapshot_transfer_mxn_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  snapshot_change_mxn NUMERIC(12,2) NOT NULL DEFAULT 0,
  expected_cash_mxn NUMERIC(12,2) NOT NULL DEFAULT 0,
  expected_cash_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  difference_mxn NUMERIC(12,2),
  difference_usd NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'draft',
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, business_date),
  CONSTRAINT cash_closures_status_valid CHECK (status IN ('draft', 'closed')),
  CONSTRAINT cash_closures_amounts_valid CHECK (
    opening_cash_mxn >= 0
    AND opening_cash_usd >= 0
    AND (counted_cash_mxn IS NULL OR counted_cash_mxn >= 0)
    AND (counted_cash_usd IS NULL OR counted_cash_usd >= 0)
    AND cash_expenses_mxn >= 0
    AND snapshot_total_sales_mxn >= 0
    AND snapshot_paid_order_count >= 0
    AND snapshot_cancelled_order_count >= 0
    AND snapshot_cash_mxn_received >= 0
    AND snapshot_cash_usd_received >= 0
    AND snapshot_card_mxn_amount >= 0
    AND snapshot_transfer_mxn_amount >= 0
    AND snapshot_change_mxn >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_cash_closures_tenant_date
  ON public.cash_closures (tenant_id, business_date DESC);

ALTER TABLE public.cash_closures ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.cash_closures FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.cash_closures TO authenticated;

DROP POLICY IF EXISTS "Restaurant owners read their cash closures" ON public.cash_closures;
CREATE POLICY "Restaurant owners read their cash closures"
  ON public.cash_closures
  FOR SELECT
  TO authenticated
  USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Restaurant owners insert their cash closures" ON public.cash_closures;
CREATE POLICY "Restaurant owners insert their cash closures"
  ON public.cash_closures
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Restaurant owners update draft cash closures" ON public.cash_closures;
CREATE POLICY "Restaurant owners update draft cash closures"
  ON public.cash_closures
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = tenant_id AND status = 'draft')
  WITH CHECK (auth.uid() = tenant_id);

CREATE OR REPLACE FUNCTION public.has_active_pro_subscription(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.tenant_id = p_tenant_id
      AND (
        s.status IN ('active', 'trialing')
        OR s.current_period_end > NOW()
      )
  );
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

  SELECT o.id, o.tenant_id, o.total, o.status
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

  IF v_order.status NOT IN ('pendiente_cocina', 'listo') THEN
    RAISE EXCEPTION 'Order cannot be paid from current status' USING ERRCODE = 'P0001';
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

CREATE OR REPLACE FUNCTION public.get_finance_day_summary(
  p_business_date DATE
)
RETURNS TABLE (
  business_date DATE,
  total_sales_mxn NUMERIC,
  paid_order_count INTEGER,
  cancelled_order_count INTEGER,
  average_ticket_mxn NUMERIC,
  cash_mxn_received NUMERIC,
  cash_usd_received NUMERIC,
  cash_usd_equivalent_mxn NUMERIC,
  card_mxn_amount NUMERIC,
  transfer_mxn_amount NUMERIC,
  change_mxn NUMERIC,
  expected_cash_mxn_from_sales NUMERIC,
  closure_id UUID,
  opening_cash_mxn NUMERIC,
  opening_cash_usd NUMERIC,
  counted_cash_mxn NUMERIC,
  counted_cash_usd NUMERIC,
  cash_expenses_mxn NUMERIC,
  expected_cash_mxn NUMERIC,
  expected_cash_usd NUMERIC,
  difference_mxn NUMERIC,
  difference_usd NUMERIC,
  closure_status TEXT,
  closure_notes TEXT,
  closed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_active_pro_subscription(v_user_id) THEN
    RAISE EXCEPTION 'Active Pro subscription required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH day_orders AS (
    SELECT o.*
    FROM public.orders o
    WHERE o.tenant_id = v_user_id
      AND COALESCE(o.paid_at, o.created_at)::DATE = p_business_date
  ),
  totals AS (
    SELECT
      COALESCE(SUM(CASE WHEN status = 'pagado' THEN total ELSE 0 END), 0)::NUMERIC(12,2) AS total_sales_mxn,
      COUNT(*) FILTER (WHERE status = 'pagado')::INTEGER AS paid_order_count,
      COUNT(*) FILTER (WHERE status = 'cancelado')::INTEGER AS cancelled_order_count,
      COALESCE(ROUND(AVG(CASE WHEN status = 'pagado' THEN total END)::NUMERIC, 2), 0)::NUMERIC(12,2) AS average_ticket_mxn,
      COALESCE(SUM(payment_cash_mxn_received), 0)::NUMERIC(12,2) AS cash_mxn_received,
      COALESCE(SUM(payment_cash_usd_received), 0)::NUMERIC(12,2) AS cash_usd_received,
      COALESCE(SUM(payment_cash_usd_received * COALESCE(payment_exchange_rate, 0)), 0)::NUMERIC(12,2) AS cash_usd_equivalent_mxn,
      COALESCE(SUM(payment_card_mxn_amount), 0)::NUMERIC(12,2) AS card_mxn_amount,
      COALESCE(SUM(payment_transfer_mxn_amount), 0)::NUMERIC(12,2) AS transfer_mxn_amount,
      COALESCE(SUM(payment_change_mxn), 0)::NUMERIC(12,2) AS change_mxn
    FROM day_orders
  )
  SELECT
    p_business_date,
    t.total_sales_mxn,
    t.paid_order_count,
    t.cancelled_order_count,
    t.average_ticket_mxn,
    t.cash_mxn_received,
    t.cash_usd_received,
    ROUND(t.cash_usd_equivalent_mxn, 2),
    t.card_mxn_amount,
    t.transfer_mxn_amount,
    t.change_mxn,
    ROUND((t.cash_mxn_received - t.change_mxn)::NUMERIC, 2),
    cc.id,
    COALESCE(cc.opening_cash_mxn, 0),
    COALESCE(cc.opening_cash_usd, 0),
    cc.counted_cash_mxn,
    cc.counted_cash_usd,
    COALESCE(cc.cash_expenses_mxn, 0),
    COALESCE(cc.expected_cash_mxn, ROUND((t.cash_mxn_received - t.change_mxn)::NUMERIC, 2)),
    COALESCE(cc.expected_cash_usd, t.cash_usd_received),
    cc.difference_mxn,
    cc.difference_usd,
    COALESCE(cc.status, 'draft'),
    COALESCE(cc.notes, ''),
    cc.closed_at
  FROM totals t
  LEFT JOIN public.cash_closures cc
    ON cc.tenant_id = v_user_id
   AND cc.business_date = p_business_date;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_cash_closure_draft(
  p_business_date DATE,
  p_opening_cash_mxn NUMERIC DEFAULT 0,
  p_opening_cash_usd NUMERIC DEFAULT 0,
  p_counted_cash_mxn NUMERIC DEFAULT NULL,
  p_counted_cash_usd NUMERIC DEFAULT NULL,
  p_cash_expenses_mxn NUMERIC DEFAULT 0,
  p_notes TEXT DEFAULT ''
)
RETURNS public.cash_closures
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_summary RECORD;
  v_closure public.cash_closures%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_active_pro_subscription(v_user_id) THEN
    RAISE EXCEPTION 'Active Pro subscription required' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(p_opening_cash_mxn, 0) < 0
    OR COALESCE(p_opening_cash_usd, 0) < 0
    OR COALESCE(p_cash_expenses_mxn, 0) < 0
    OR COALESCE(p_counted_cash_mxn, 0) < 0
    OR COALESCE(p_counted_cash_usd, 0) < 0 THEN
    RAISE EXCEPTION 'Negative closure values are not allowed' USING ERRCODE = '22003';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.cash_closures cc
    WHERE cc.tenant_id = v_user_id
      AND cc.business_date = p_business_date
      AND cc.status = 'closed'
  ) THEN
    RAISE EXCEPTION 'Cash closure is already closed' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_summary
  FROM public.get_finance_day_summary(p_business_date)
  LIMIT 1;

  INSERT INTO public.cash_closures (
    tenant_id,
    business_date,
    opening_cash_mxn,
    opening_cash_usd,
    counted_cash_mxn,
    counted_cash_usd,
    cash_expenses_mxn,
    notes,
    snapshot_total_sales_mxn,
    snapshot_paid_order_count,
    snapshot_cancelled_order_count,
    snapshot_cash_mxn_received,
    snapshot_cash_usd_received,
    snapshot_card_mxn_amount,
    snapshot_transfer_mxn_amount,
    snapshot_change_mxn,
    expected_cash_mxn,
    expected_cash_usd,
    difference_mxn,
    difference_usd,
    status
  ) VALUES (
    v_user_id,
    p_business_date,
    ROUND(COALESCE(p_opening_cash_mxn, 0)::NUMERIC, 2),
    ROUND(COALESCE(p_opening_cash_usd, 0)::NUMERIC, 2),
    CASE WHEN p_counted_cash_mxn IS NULL THEN NULL ELSE ROUND(p_counted_cash_mxn::NUMERIC, 2) END,
    CASE WHEN p_counted_cash_usd IS NULL THEN NULL ELSE ROUND(p_counted_cash_usd::NUMERIC, 2) END,
    ROUND(COALESCE(p_cash_expenses_mxn, 0)::NUMERIC, 2),
    LEFT(TRIM(COALESCE(p_notes, '')), 1000),
    v_summary.total_sales_mxn,
    v_summary.paid_order_count,
    v_summary.cancelled_order_count,
    v_summary.cash_mxn_received,
    v_summary.cash_usd_received,
    v_summary.card_mxn_amount,
    v_summary.transfer_mxn_amount,
    v_summary.change_mxn,
    ROUND((COALESCE(p_opening_cash_mxn, 0) + v_summary.cash_mxn_received - v_summary.change_mxn - COALESCE(p_cash_expenses_mxn, 0))::NUMERIC, 2),
    ROUND((COALESCE(p_opening_cash_usd, 0) + v_summary.cash_usd_received)::NUMERIC, 2),
    CASE WHEN p_counted_cash_mxn IS NULL THEN NULL ELSE ROUND((p_counted_cash_mxn - (COALESCE(p_opening_cash_mxn, 0) + v_summary.cash_mxn_received - v_summary.change_mxn - COALESCE(p_cash_expenses_mxn, 0)))::NUMERIC, 2) END,
    CASE WHEN p_counted_cash_usd IS NULL THEN NULL ELSE ROUND((p_counted_cash_usd - (COALESCE(p_opening_cash_usd, 0) + v_summary.cash_usd_received))::NUMERIC, 2) END,
    'draft'
  )
  ON CONFLICT (tenant_id, business_date)
  DO UPDATE SET
    opening_cash_mxn = EXCLUDED.opening_cash_mxn,
    opening_cash_usd = EXCLUDED.opening_cash_usd,
    counted_cash_mxn = EXCLUDED.counted_cash_mxn,
    counted_cash_usd = EXCLUDED.counted_cash_usd,
    cash_expenses_mxn = EXCLUDED.cash_expenses_mxn,
    notes = EXCLUDED.notes,
    snapshot_total_sales_mxn = EXCLUDED.snapshot_total_sales_mxn,
    snapshot_paid_order_count = EXCLUDED.snapshot_paid_order_count,
    snapshot_cancelled_order_count = EXCLUDED.snapshot_cancelled_order_count,
    snapshot_cash_mxn_received = EXCLUDED.snapshot_cash_mxn_received,
    snapshot_cash_usd_received = EXCLUDED.snapshot_cash_usd_received,
    snapshot_card_mxn_amount = EXCLUDED.snapshot_card_mxn_amount,
    snapshot_transfer_mxn_amount = EXCLUDED.snapshot_transfer_mxn_amount,
    snapshot_change_mxn = EXCLUDED.snapshot_change_mxn,
    expected_cash_mxn = EXCLUDED.expected_cash_mxn,
    expected_cash_usd = EXCLUDED.expected_cash_usd,
    difference_mxn = EXCLUDED.difference_mxn,
    difference_usd = EXCLUDED.difference_usd,
    updated_at = NOW()
  WHERE public.cash_closures.status = 'draft'
  RETURNING * INTO v_closure;

  RETURN v_closure;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_cash_closure(
  p_business_date DATE,
  p_opening_cash_mxn NUMERIC DEFAULT 0,
  p_opening_cash_usd NUMERIC DEFAULT 0,
  p_counted_cash_mxn NUMERIC DEFAULT NULL,
  p_counted_cash_usd NUMERIC DEFAULT NULL,
  p_cash_expenses_mxn NUMERIC DEFAULT 0,
  p_notes TEXT DEFAULT ''
)
RETURNS public.cash_closures
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_closure public.cash_closures%ROWTYPE;
BEGIN
  IF p_counted_cash_mxn IS NULL OR p_counted_cash_usd IS NULL THEN
    RAISE EXCEPTION 'Counted cash is required to close cash closure' USING ERRCODE = '22004';
  END IF;

  SELECT *
  INTO v_closure
  FROM public.save_cash_closure_draft(
    p_business_date,
    p_opening_cash_mxn,
    p_opening_cash_usd,
    p_counted_cash_mxn,
    p_counted_cash_usd,
    p_cash_expenses_mxn,
    p_notes
  );

  UPDATE public.cash_closures cc
  SET
    status = 'closed',
    closed_at = NOW(),
    updated_at = NOW()
  WHERE cc.id = v_closure.id
    AND cc.tenant_id = auth.uid()
    AND cc.status = 'draft'
  RETURNING * INTO v_closure;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cash closure could not be closed' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_closure;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.has_active_pro_subscription(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_pro_subscription(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.capture_order_payment(UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.capture_order_payment(UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_finance_day_summary(DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_finance_day_summary(DATE) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.save_cash_closure_draft(DATE, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_cash_closure_draft(DATE, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.close_cash_closure(DATE, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_cash_closure(DATE, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
