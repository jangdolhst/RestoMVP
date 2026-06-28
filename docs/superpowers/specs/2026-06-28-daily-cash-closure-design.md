# Daily Cash Closure and Finance Pro Design

## Summary

Jamm Free will keep the free plan focused on receiving, creating, and charging orders. The Pro plan will add a dedicated finance area for daily cash closure, payment breakdowns, and basic operational reports.

The first version intentionally supports one cash register per restaurant and one closure per restaurant per day. It will not support cashier users, shifts, multiple registers, inventory, payroll, or advanced accounting.

## Goals

- Keep order reception, manual orders, kitchen flow, and marking orders as paid usable in the free plan.
- Require a payment capture step when marking an order as paid.
- Support mixed payments across cash MXN, cash USD, card MXN, and transfer MXN.
- Store the USD exchange rate in restaurant settings, not in the finance page.
- Always calculate and register change in MXN.
- Add a Pro-only `/finanzas` section for daily cash closure and historical finance views.
- Let restaurants compare expected physical cash against counted cash at the end of the day.

## Non-Goals

- No internal cashier accounts.
- No shifts.
- No multiple cash registers.
- No fiscal invoice generation.
- No payroll or inventory.
- No automatic currency exchange-rate provider.
- No card/transfer USD in the first version.
- No advanced accounting ledger.

## Plan Boundaries

### Free Plan

Free restaurants can:

- Receive online orders.
- Create orders from the restaurant.
- Use kitchen flow.
- Mark orders as paid.
- Capture payment details required to close an order.
- Use basic menu and restaurant settings.

The payment modal is free because charging orders is essential to the core workflow.

### Pro Plan

Pro restaurants can:

- Access `/finanzas`.
- View daily sales dashboard.
- Close daily cash.
- Save counted cash and notes.
- View closure history.
- Use weekly/monthly summaries.
- Print/export finance reports in later iterations.

## Payment Capture

When a restaurant marks an order as paid, the app opens a required payment modal.

The modal shows:

- Order total in MXN.
- Current configured exchange rate, if USD payments are enabled.
- Cash MXN received.
- Cash USD received.
- Card MXN received.
- Transfer MXN received.
- Equivalent received in MXN.
- Suggested change in MXN.
- Remaining amount if the payment does not cover the order.

Allowed payment sources:

- Cash MXN.
- Cash USD.
- Card MXN.
- Transfer MXN.

No `other` payment method will be available.

### Validation Rules

- At least one payment source is required.
- Card and transfer amounts are applied values, not tendered amounts.
- Cash amounts are tendered amounts.
- USD cash uses the restaurant exchange rate saved in settings.
- If cash/card/transfer does not cover the order total, the payment cannot be confirmed.
- If cash overpays the order, the app calculates change in MXN.
- Change is always MXN.
- The effective paid amount must equal the order total after subtracting calculated change.
- Negative values are rejected.
- Values are rounded to two decimals for stored monetary fields.

### Examples

#### Exact MXN Cash

- Order total: 350 MXN.
- Cash MXN received: 350.
- Change MXN: 0.
- Effective paid amount: 350.

#### USD Plus MXN

- Order total: 350 MXN.
- Exchange rate: 18.50.
- Cash USD received: 10.
- USD equivalent: 185 MXN.
- Remaining: 165 MXN.
- Cash MXN received: 165.
- Change MXN: 0.
- Effective paid amount: 350.

#### USD Overpayment

- Order total: 350 MXN.
- Exchange rate: 18.50.
- Cash USD received: 20.
- USD equivalent: 370 MXN.
- Change MXN: 20.
- Effective paid amount: 350.

This supports real caja behavior while avoiding manual calculator work.

## Restaurant Settings

`/settings` will include a Pro-adjacent but operationally necessary payment configuration section.

Fields:

- Accept USD payments.
- USD exchange rate.

Rules:

- USD payments can only be captured if USD is enabled.
- Exchange rate must be greater than zero when USD is enabled.
- The exchange rate used on an order is snapshotted into that order at payment time.
- Changing the exchange rate later does not modify old paid orders.

This configuration belongs in settings because it is a restaurant-level operational configuration, not a finance report.

## Finance Page

`/finanzas` will be a dedicated Pro route.

It will not replace `/pagos`.

### `/pagos`

Purpose: operational charging.

Contains:

- Pending online order confirmations.
- Orders ready to charge.
- Payment modal when marking paid.
- Payment status update.

### `/finanzas`

Purpose: reporting and cash closure.

Contains:

- Today's sales summary.
- Payment method breakdown.
- Cash closure form.
- Closure status for the day.
- Closure history.

## Daily Dashboard

The finance dashboard for the selected date shows:

- Total sales in MXN.
- Paid order count.
- Cancelled order count.
- Average ticket.
- Cash MXN received.
- Cash USD received.
- USD equivalent in MXN.
- Card MXN.
- Transfer MXN.
- Change given in MXN.
- Net expected cash MXN.

Suggested formula:

```text
net_cash_mxn_from_sales = cash_mxn_received - change_mxn
cash_usd_expected = cash_usd_received
```

Card and transfer do not affect physical cash.

## Daily Cash Closure

One closure is allowed per restaurant per local business date.

Closure fields:

- Business date.
- Opening cash MXN.
- Opening cash USD.
- Counted cash MXN.
- Counted cash USD.
- Manual expenses/retires MXN.
- Notes.
- Snapshot totals from orders.
- Calculated expected cash MXN.
- Calculated expected cash USD.
- Calculated difference MXN.
- Calculated difference USD.
- Closed timestamp.

Suggested formulas:

```text
expected_cash_mxn = opening_cash_mxn + cash_mxn_received - change_mxn - cash_expenses_mxn
expected_cash_usd = opening_cash_usd + cash_usd_received
difference_mxn = counted_cash_mxn - expected_cash_mxn
difference_usd = counted_cash_usd - expected_cash_usd
```

For the first version, expenses/retires are a single MXN amount plus notes. A detailed expenses table can be added later.

## Closure Behavior

- If no closure exists for today, `/finanzas` shows an open closure form.
- The restaurant can save/update draft values before closing.
- Closing stores a snapshot of the calculated totals for that business date.
- After closing, the closure becomes read-only in the first version.
- If an old order is modified after closure, the closed snapshot does not change.
- Reopening closures is not included in the first version.

## Data Model Draft

### `orders` Additions

Add payment capture fields:

- `payment_cash_mxn_received numeric(12,2) not null default 0`
- `payment_cash_usd_received numeric(12,2) not null default 0`
- `payment_card_mxn_amount numeric(12,2) not null default 0`
- `payment_transfer_mxn_amount numeric(12,2) not null default 0`
- `payment_exchange_rate numeric(12,4)`
- `payment_change_mxn numeric(12,2) not null default 0`
- `payment_total_effective_mxn numeric(12,2) not null default 0`
- `paid_at timestamptz`

The app may derive display labels like `cash`, `card`, `transfer`, or `mixed`; it should not rely on a single `payment_method` column because mixed payment is first-class.

### `restaurant_profiles` Additions

Add restaurant payment configuration:

- `accepts_usd boolean not null default false`
- `usd_exchange_rate numeric(12,4)`

These fields are not sensitive. They can be visible to the restaurant owner and used by the authenticated frontend.

### `cash_closures`

New table:

- `id uuid primary key default gen_random_uuid()`
- `tenant_id uuid not null references public.restaurant_profiles(id) on delete cascade`
- `business_date date not null`
- `opening_cash_mxn numeric(12,2) not null default 0`
- `opening_cash_usd numeric(12,2) not null default 0`
- `counted_cash_mxn numeric(12,2)`
- `counted_cash_usd numeric(12,2)`
- `cash_expenses_mxn numeric(12,2) not null default 0`
- `notes text not null default ''`
- `snapshot_total_sales_mxn numeric(12,2) not null default 0`
- `snapshot_paid_order_count integer not null default 0`
- `snapshot_cancelled_order_count integer not null default 0`
- `snapshot_cash_mxn_received numeric(12,2) not null default 0`
- `snapshot_cash_usd_received numeric(12,2) not null default 0`
- `snapshot_card_mxn_amount numeric(12,2) not null default 0`
- `snapshot_transfer_mxn_amount numeric(12,2) not null default 0`
- `snapshot_change_mxn numeric(12,2) not null default 0`
- `expected_cash_mxn numeric(12,2) not null default 0`
- `expected_cash_usd numeric(12,2) not null default 0`
- `difference_mxn numeric(12,2)`
- `difference_usd numeric(12,2)`
- `status text not null default 'draft'`
- `closed_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- Unique `(tenant_id, business_date)`.
- `status in ('draft', 'closed')`.
- Monetary fields cannot be negative, except differences.

## Security and RLS

- Enable RLS on `cash_closures`.
- Only authenticated restaurant owners can read/write their own closures.
- Public `anon` users must not read finance data.
- Finance RPCs must verify `auth.uid() = tenant_id`.
- Pro-only actions should be enforced in both frontend and database where practical.
- Any `SECURITY DEFINER` functions must use `SET search_path = ''`.

Potential RPCs:

- `get_finance_day_summary(p_business_date date)`
- `save_cash_closure_draft(...)`
- `close_cash_closure(...)`

The payment capture itself can be implemented through authenticated update rules or an RPC. An RPC is safer because it can validate exact totals, exchange rate usage, and tenant ownership in one place.

## UI Structure

### Navigation

Add `Finanzas` to the business layout navigation.

Recommended icon: wallet, chart, or calculator.

### Payment Modal

The modal should be fast, keyboard-friendly, and not feel like accounting software.

Main sections:

- Total due.
- Cash inputs.
- Digital payment inputs.
- Calculated remaining/change.
- Confirm button.

Confirm button states:

- Disabled if no payment source.
- Disabled if payment does not cover total.
- Enabled when effective paid amount equals total after change.

### Finance Page

Sections:

- Header with selected date.
- Daily KPI cards.
- Payment breakdown.
- Cash closure card.
- Closure history list.

If the user is not Pro:

- Show `FeatureGate` with a clear explanation:
  - Orders remain free.
  - Pro unlocks daily cash closure, finance reports, and business control.

## i18n

All visible strings must be added to Spanish and English resources.

Required namespaces/keys:

- `finance.*`
- `payments.paymentModal.*`
- `settings.paymentSettings.*`
- `premium.features.cashClosure.*`

## Testing

### Unit Tests

- Payment math:
  - Exact MXN cash.
  - USD plus MXN.
  - USD overpayment with MXN change.
  - Mixed cash/card/transfer.
  - Rejection of negative values.
  - Rejection when USD is disabled but USD amount is entered.
- Finance summary:
  - Cash expected formulas.
  - USD expected formulas.
  - Difference calculations.

### Static Migration Tests

- `cash_closures` table has RLS enabled.
- `anon` has no direct finance access.
- Closure uniqueness exists.
- RPCs use `search_path = ''`.
- Pro guard exists for closure actions.

### Integration/Smoke Tests

- Mark order as paid with exact MXN.
- Mark order as paid with USD plus MXN.
- Open `/finanzas` as non-Pro and see gate.
- Open `/finanzas` as Pro and see today's summary.
- Save draft closure.
- Close daily closure.
- Confirm closed closure is read-only.

## Rollout Plan

1. Add schema and payment calculation helpers.
2. Add payment modal to `/pagos`.
3. Add payment settings to `/settings`.
4. Add `/finanzas` route behind Pro gate.
5. Add cash closure draft/close flow.
6. Add tests and run full verification.
7. Apply SQL manually or through Supabase MCP once permissions are fixed.
8. Deploy after DB verification.

## Implementation Decisions

- Payment capture will use an RPC from day one so total validation, exchange-rate snapshotting, tenant ownership, and status updates happen atomically.
- Closure drafts will use an explicit save button. There will be no autosave in the first version.
- Business date will initially use the browser local date. A future restaurant timezone setting can replace this if restaurants operate across timezones.
