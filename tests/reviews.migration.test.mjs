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
  assert.match(normalized, /grant execute on function public\.create_restaurant_review\(uuid, uuid, text, text, integer, text\) to authenticated/);
  assert.match(normalized, /grant execute on function public\.get_review_eligibility\(uuid, uuid\) to authenticated/);
  assert.match(normalized, /grant execute on function public\.get_restaurant_reviews\(uuid, integer\) to authenticated/);
  assert.match(normalized, /grant execute on function public\.get_restaurant_review_summary\(uuid\[\]\) to authenticated/);
});

test('public eligibility and reader surfaces do not expose sensitive order fields', () => {
  const eligibilityStart = normalized.indexOf('create or replace function public.get_review_eligibility');
  const createReviewStart = normalized.indexOf('create or replace function public.create_restaurant_review');
  const readersStart = normalized.indexOf('create or replace function public.get_restaurant_reviews');
  const summaryStart = normalized.indexOf('create or replace function public.get_restaurant_review_summary');

  assert.ok(eligibilityStart !== -1);
  assert.ok(createReviewStart !== -1);
  assert.ok(readersStart !== -1);
  assert.ok(summaryStart !== -1);

  const eligibility = normalized.slice(eligibilityStart, createReviewStart);
  const readers = normalized.slice(readersStart, summaryStart);
  const summary = normalized.slice(summaryStart);

  assert.match(eligibility, /returns table \( eligible boolean, reason text, order_status text, client_name text, phone_hint text \)/);
  assert.doesNotMatch(eligibility, /order_id uuid/);
  const eligibilityReturns = eligibility.match(/return query select[\s\S]*?;/g) ?? [];
  assert.ok(eligibilityReturns.length > 0);
  for (const row of eligibilityReturns) {
    assert.doesNotMatch(row, /v_order\.id/);
    assert.doesNotMatch(row, /order_token/);
    assert.doesNotMatch(row, /customer_phone_normalized/);
  }
  assert.doesNotMatch(readers, /order_token/);
  assert.doesNotMatch(readers, /customer_phone_normalized/);
  assert.doesNotMatch(readers, /order_id uuid/);
  assert.doesNotMatch(summary, /order_token/);
  assert.doesNotMatch(summary, /customer_phone_normalized/);
  assert.doesNotMatch(summary, /order_id uuid/);
});

test('eligibility checks duplicate review phone before returning eligible', () => {
  const eligibilityStart = normalized.indexOf('create or replace function public.get_review_eligibility');
  const createReviewStart = normalized.indexOf('create or replace function public.create_restaurant_review');
  assert.ok(eligibilityStart !== -1);
  assert.ok(createReviewStart !== -1);

  const eligibility = normalized.slice(eligibilityStart, createReviewStart);

  assert.match(eligibility, /v_phone_digits := public\.normalize_review_phone\(v_order\.phone\)/);
  assert.match(
    eligibility,
    /if exists \(\s*select 1 from public\.restaurant_reviews rr\s*where rr\.restaurant_id = p_restaurant_id\s*and rr\.customer_phone_normalized = v_phone_digits\s*\) then\s*return query select false, 'already_reviewed'/
  );
});

test('review creation trims blank customer names before fallback', () => {
  const createReviewStart = normalized.indexOf('create or replace function public.create_restaurant_review');
  const readersStart = normalized.indexOf('create or replace function public.get_restaurant_reviews');
  assert.ok(createReviewStart !== -1);
  assert.ok(readersStart !== -1);

  const createReview = normalized.slice(createReviewStart, readersStart);

  assert.match(
    createReview,
    /v_customer_name := left\(coalesce\(nullif\(trim\(p_customer_name\), ''\), nullif\(trim\(v_order\.client_name\), ''\), 'cliente'\), 80\)/
  );
});
