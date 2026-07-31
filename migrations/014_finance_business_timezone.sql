BEGIN;

DROP FUNCTION IF EXISTS public.get_finance_day_summary(DATE);
DROP FUNCTION IF EXISTS public.save_cash_closure_draft(DATE, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.close_cash_closure(DATE, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.get_finance_day_summary(
  p_business_date DATE,
  p_timezone TEXT DEFAULT 'America/Tijuana'
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
  v_timezone TEXT := COALESCE(NULLIF(TRIM(p_timezone), ''), 'America/Tijuana');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_timezone_names t
    WHERE t.name = v_timezone
  ) THEN
    v_timezone := 'America/Tijuana';
  END IF;

  IF NOT public.has_active_pro_subscription(v_user_id) THEN
    RAISE EXCEPTION 'Active Pro subscription required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH day_orders AS (
    SELECT o.*
    FROM public.orders o
    WHERE o.tenant_id = v_user_id
      AND (COALESCE(o.paid_at, o.created_at) AT TIME ZONE v_timezone)::DATE = p_business_date
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
  p_notes TEXT DEFAULT '',
  p_timezone TEXT DEFAULT 'America/Tijuana'
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
  FROM public.get_finance_day_summary(p_business_date, p_timezone)
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
  p_notes TEXT DEFAULT '',
  p_timezone TEXT DEFAULT 'America/Tijuana'
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
    p_notes,
    p_timezone
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

REVOKE EXECUTE ON FUNCTION public.get_finance_day_summary(DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_finance_day_summary(DATE, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.save_cash_closure_draft(DATE, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_cash_closure_draft(DATE, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.close_cash_closure(DATE, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_cash_closure(DATE, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
