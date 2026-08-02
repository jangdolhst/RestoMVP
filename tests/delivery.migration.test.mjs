import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readMigration = () => readFileSync(new URL('../migrations/016_delivery_orders.sql', import.meta.url), 'utf8')
  .toLowerCase()
  .replace(/\s+/g, ' ');

test('delivery migration adds profile and order delivery columns', () => {
  const normalized = readMigration();

  assert.match(normalized, /add column if not exists delivery_service_mode text not null default 'pickup_only'/);
  assert.match(normalized, /add column if not exists delivery_fee_mode text not null default 'manual'/);
  assert.match(normalized, /add column if not exists fulfillment_type text not null default 'pickup'/);
  assert.match(normalized, /add column if not exists delivery_fee_mxn numeric\(10,2\) not null default 0/);
  assert.match(normalized, /add constraint restaurant_profiles_delivery_service_mode_valid/);
  assert.match(normalized, /add constraint orders_delivery_fee_status_valid/);
});

test('public order rpc accepts delivery metadata but never a client delivery fee', () => {
  const normalized = readMigration();

  assert.match(normalized, /drop function if exists public\.create_public_order\(uuid, text, text, jsonb\)/);
  assert.match(normalized, /create or replace function public\.create_public_order\(/);
  assert.match(normalized, /p_fulfillment_type text default 'pickup'/);
  assert.match(normalized, /p_delivery_latitude numeric default null/);
  assert.match(normalized, /v_delivery_fee_mxn/);
  assert.match(normalized, /v_delivery_distance_km/);
  assert.match(normalized, /radians\(/);
  const publicOrderSection = normalized.slice(0, normalized.indexOf('create or replace function public.set_manual_delivery_fee'));
  assert.doesNotMatch(publicOrderSection, /p_delivery_fee_mxn/);
  assert.match(normalized, /grant execute on function public\.create_public_order\(uuid, text, text, jsonb, text, text, text, numeric, numeric\) to anon/);
});

test('manual fee rpc is tenant checked and authenticated only', () => {
  const normalized = readMigration();

  assert.match(normalized, /create or replace function public\.set_manual_delivery_fee\(p_order_id uuid, p_delivery_fee_mxn numeric\)/);
  assert.match(normalized, /auth\.uid\(\) <> v_order\.tenant_id/);
  assert.match(normalized, /delivery_fee_status = 'pending_manual'/);
  assert.match(normalized, /revoke execute on function public\.set_manual_delivery_fee\(uuid, numeric\) from public, anon/);
  assert.match(normalized, /grant execute on function public\.set_manual_delivery_fee\(uuid, numeric\) to authenticated/);
});

test('tracking rpc includes delivery fields for token-only client tracking', () => {
  const normalized = readMigration();

  assert.match(normalized, /create or replace function public\.get_orders_by_tokens\(tokens uuid\[\]\)/);
  assert.match(normalized, /fulfillment_type text/);
  assert.match(normalized, /delivery_address text/);
  assert.match(normalized, /delivery_fee_mxn numeric/);
  assert.match(normalized, /delivery_fee_status text/);
  assert.match(normalized, /where o\.order_token = any\(safe_tokens\)/);
  assert.match(normalized, /revoke execute on function public\.get_orders_by_tokens\(uuid\[\]\) from public, authenticated/);
  assert.match(normalized, /grant execute on function public\.get_orders_by_tokens\(uuid\[\]\) to anon/);
});

