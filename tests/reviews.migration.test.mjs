import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync(new URL('../migrations/012_restaurant_reviews.sql', import.meta.url), 'utf8');
const normalized = sql.replace(/\s+/g, ' ').toLowerCase();

test('reviews migration enables RLS and blocks direct public writes', () => {
  assert.match(normalized, /create table if not exists public\.restaurant_reviews/);
  assert.match(normalized, /alter table public\.restaurant_reviews enable row level security/);
  assert.match(normalized, /revoke all on table public\.restaurant_reviews from public, anon, authenticated/);
  assert.doesNotMatch(normalized, /grant insert on table public\.restaurant_reviews to anon/);
  assert.doesNotMatch(normalized, /grant update on table public\.restaurant_reviews to anon/);
});

test('reviews migration exposes only controlled RPCs to anon', () => {
  assert.match(normalized, /security definer/);
  assert.match(normalized, /set search_path = ''/);
  assert.match(normalized, /grant execute on function public\.create_restaurant_review\(uuid, uuid, text, text, integer, text\) to anon/);
  assert.match(normalized, /grant execute on function public\.get_review_eligibility\(uuid, uuid\) to anon/);
  assert.match(normalized, /grant execute on function public\.get_restaurant_reviews\(uuid, integer\) to anon/);
  assert.match(normalized, /grant execute on function public\.get_restaurant_review_summary\(uuid\[\]\) to anon/);
});

test('public review readers do not return order tokens or phone numbers', () => {
  const publicReaders = normalized.slice(normalized.indexOf('create or replace function public.get_restaurant_reviews'));
  assert.doesNotMatch(publicReaders, /customer_phone_normalized/);
  assert.doesNotMatch(publicReaders, /order_token/);
});
