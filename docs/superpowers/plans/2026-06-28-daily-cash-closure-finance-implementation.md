# Daily Cash Closure Finance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Pro finance controls with required payment capture, mixed MXN/USD payments, and daily cash closure.

**Architecture:** Payment math lives in focused pure helpers, DB enforcement lives in migration RPCs, and UI is split between a payment modal, settings payment config, and a new `/finanzas` page. `/pagos` remains operational; `/finanzas` is Pro-only reporting/cash closure.

**Tech Stack:** React 19, Vite 8, Supabase Postgres/RLS/RPC, `node:test`, `react-i18next`, Tailwind CSS utility classes.

## Global Constraints

- One cash register per restaurant.
- One cash closure per restaurant per day.
- No cashier users, shifts, multiple registers, payroll, inventory, or advanced accounting.
- Free plan keeps order reception, manual order creation, kitchen flow, and payment capture.
- Pro plan gates `/finanzas`, cash closures, and finance reports.
- Payment capture supports only cash MXN, cash USD, card MXN, and transfer MXN.
- USD exchange rate is configured in `/settings`.
- Change is always calculated and stored in MXN.
- Payment capture must use an RPC.
- Closure drafts use explicit save.
- Business date uses browser local date in the first version.

---

### Task 1: Payment and Finance Helpers

**Files:**
- Create: `src/lib/paymentMath.js`
- Create: `tests/paymentMath.test.mjs`
- Modify: `src/lib/features.js`
- Modify: `tests/features.test.mjs`

**Interfaces:**
- Produces: `PAYMENT_FIELDS`, `roundMoney(value)`, `calculatePaymentBreakdown(input)`, `calculateCashClosure(input)`, `normalizePaymentInput(input)`.
- Produces: `PREMIUM_FEATURES.cashClosure`.

- [ ] Write failing `node:test` tests for exact MXN cash, USD+MXN, USD overpayment/change, mixed card/transfer, disabled USD rejection, negative rejection, and closure formulas.
- [ ] Run `node --test tests\paymentMath.test.mjs tests\features.test.mjs` and verify expected failures.
- [ ] Implement pure helper functions in `src/lib/paymentMath.js`.
- [ ] Add `cashClosure` to premium features and tests.
- [ ] Re-run helper tests and commit.

### Task 2: Database Contract and Static Migration Tests

**Files:**
- Create: `migrations/013_cash_closure_finance.sql`
- Create: `tests/finance.migration.test.mjs`

**Interfaces:**
- Produces RPCs: `capture_order_payment`, `get_finance_day_summary`, `save_cash_closure_draft`, `close_cash_closure`.
- Produces table: `public.cash_closures`.
- Produces columns on `orders` and `restaurant_profiles` defined by the spec.

- [ ] Write static migration tests checking RLS, anon denial, tenant ownership, Pro guard, `search_path = ''`, payment fields, and closure uniqueness.
- [ ] Run `node --test tests\finance.migration.test.mjs` and verify expected failures.
- [ ] Write migration SQL with safe `ALTER TABLE ADD COLUMN IF NOT EXISTS`, RLS, policies, and RPCs.
- [ ] Re-run migration tests and commit.

### Task 3: Payment Modal and `/pagos` Integration

**Files:**
- Create: `src/components/payments/PaymentCaptureModal.jsx`
- Modify: `src/context/POSContext.jsx`
- Modify: `src/pages/PagosPage.jsx`
- Modify: `src/i18n/resources/es.js`
- Modify: `src/i18n/resources/en.js`
- Modify: `tests/i18n.resources.test.mjs`

**Interfaces:**
- Consumes: `calculatePaymentBreakdown` from Task 1.
- Consumes RPC: `capture_order_payment` from Task 2.
- Produces context action: `captureOrderPayment(order, paymentInput)`.

- [ ] Add i18n critical keys test for payment modal strings.
- [ ] Run i18n/helper tests and verify failures.
- [ ] Add payment fields to order selects/mapping in `POSContext`.
- [ ] Implement `captureOrderPayment` using Supabase RPC and optimistic local update.
- [ ] Implement `PaymentCaptureModal` with required fields, USD toggle behavior, remaining/change display, and disabled confirm until valid.
- [ ] Replace direct `updateOrderStatus(order.id, 'pagado')` in `/pagos` with modal flow.
- [ ] Re-run tests, lint, and commit.

### Task 4: Settings Payment Configuration

**Files:**
- Modify: `src/pages/SettingsPage.jsx`
- Modify: `src/context/POSContext.jsx`
- Modify: `src/i18n/resources/es.js`
- Modify: `src/i18n/resources/en.js`

**Interfaces:**
- Consumes/produces restaurant profile fields: `accepts_usd`, `usd_exchange_rate`.

- [ ] Add payment settings UI in `/settings` with `accepts_usd` and `usd_exchange_rate`.
- [ ] Load and save those fields with the existing profile flow.
- [ ] Validate exchange rate greater than zero when USD is enabled.
- [ ] Re-run lint/build smoke and commit.

### Task 5: Finance Page, Route, and Navigation

**Files:**
- Create: `src/pages/FinancePage.jsx`
- Modify: `src/App.jsx`
- Modify: `src/layouts/MainLayout.jsx`
- Modify: `src/components/ui/MobileBottomNav.jsx` if needed for admin hiding.
- Modify: `src/i18n/resources/es.js`
- Modify: `src/i18n/resources/en.js`
- Modify: `tests/i18n.resources.test.mjs`

**Interfaces:**
- Consumes RPCs: `get_finance_day_summary`, `save_cash_closure_draft`, `close_cash_closure`.
- Consumes feature: `PREMIUM_FEATURES.cashClosure`.

- [ ] Add route `/finanzas` behind protected layout.
- [ ] Add `Finanzas` nav item.
- [ ] Build `FinancePage` with Pro `FeatureGate`, date selector, KPI cards, payment breakdown, closure form, save draft, close closure, and history list.
- [ ] Add Spanish/English strings and tests for critical keys.
- [ ] Re-run tests, lint, build, and commit.

### Task 6: Final Verification and SQL Handoff

**Files:**
- Modify only if verification exposes bugs.

**Interfaces:**
- Produces final instructions for applying `migrations/013_cash_closure_finance.sql` manually if Supabase MCP still lacks write permission.

- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run `node --test tests\features.test.mjs tests\i18n.resources.test.mjs tests\useCityDetection.cache.test.mjs tests\reviews.helpers.test.mjs tests\reviews.migration.test.mjs tests\paymentMath.test.mjs tests\finance.migration.test.mjs`.
- [ ] Run local preview smoke for `/pagos`, `/settings`, and `/finanzas`.
- [ ] Confirm git status and report SQL apply instructions.
