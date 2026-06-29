import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync(new URL('../migrations/013_cash_closure_finance.sql', import.meta.url), 'utf8');
const normalized = sql.replace(/\s+/g, ' ').toLowerCase();

test('finance migration adds required payment columns to orders', () => {
  for (const column of [
    'payment_cash_mxn_received',
    'payment_cash_usd_received',
    'payment_card_mxn_amount',
    'payment_transfer_mxn_amount',
    'payment_exchange_rate',
    'payment_change_mxn',
    'payment_total_effective_mxn',
    'paid_at',
  ]) {
    assert.match(normalized, new RegExp(`add column if not exists ${column}`));
  }
});

test('finance migration adds USD payment settings to restaurant profiles', () => {
  assert.match(normalized, /alter table public\.restaurant_profiles/);
  assert.match(normalized, /add column if not exists accepts_usd/);
  assert.match(normalized, /add column if not exists usd_exchange_rate/);
});

test('finance migration creates cash closures with RLS and one closure per day', () => {
  assert.match(normalized, /create table if not exists public\.cash_closures/);
  assert.match(normalized, /alter table public\.cash_closures enable row level security/);
  assert.match(normalized, /unique \(tenant_id, business_date\)/);
  assert.match(normalized, /status in \('draft', 'closed'\)/);
});

test('finance migration blocks anon from finance data and RPCs', () => {
  assert.match(normalized, /revoke all on table public\.cash_closures from public, anon/);
  assert.match(normalized, /revoke execute on function public\.capture_order_payment/);
  assert.doesNotMatch(normalized, /grant execute on function public\.capture_order_payment[^;]+ to anon/);
  assert.doesNotMatch(normalized, /grant select on table public\.cash_closures to anon/);
});

test('finance RPCs are security definer with fixed search path', () => {
  for (const fn of [
    'capture_order_payment',
    'get_finance_day_summary',
    'save_cash_closure_draft',
    'close_cash_closure',
  ]) {
    assert.match(normalized, new RegExp(`create or replace function public\\.${fn}`));
  }

  const definerCount = (normalized.match(/security definer/g) || []).length;
  const searchPathCount = (normalized.match(/set search_path = ''/g) || []).length;
  assert.ok(definerCount >= 4);
  assert.ok(searchPathCount >= 4);
});

test('payment capture RPC validates tenant, total, USD settings, and marks paid atomically', () => {
  assert.match(normalized, /auth\.uid\(\) <> v_order\.tenant_id/);
  assert.match(normalized, /v_order\.status not in \('pendiente_cocina', 'listo'\)/);
  assert.match(normalized, /p_cash_usd_received > 0 and not coalesce\(v_profile\.accepts_usd, false\)/);
  assert.match(normalized, /v_effective_paid_mxn <> v_order_total/);
  assert.match(normalized, /status = 'pagado'/);
  assert.match(normalized, /paid_at = now\(\)/);
});

test('cash closure RPCs enforce Pro subscription before writing closures', () => {
  assert.match(normalized, /active pro subscription required/);
  assert.match(normalized, /from public\.subscriptions s/);
  assert.match(normalized, /s\.status in \('active', 'trialing'\)/);
});
