import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync(new URL('../migrations/014_finance_business_timezone.sql', import.meta.url), 'utf8');
const normalized = sql.replace(/\s+/g, ' ').toLowerCase();
const financePage = readFileSync(new URL('../src/pages/FinancePage.jsx', import.meta.url), 'utf8');

test('finance timezone migration replaces old RPC signatures safely', () => {
  assert.match(normalized, /drop function if exists public\.get_finance_day_summary\(date\)/);
  assert.match(normalized, /drop function if exists public\.save_cash_closure_draft\(date, numeric, numeric, numeric, numeric, numeric, text\)/);
  assert.match(normalized, /drop function if exists public\.close_cash_closure\(date, numeric, numeric, numeric, numeric, numeric, text\)/);
});

test('finance summary groups orders by local business timezone', () => {
  assert.match(normalized, /p_timezone text default 'america\/tijuana'/);
  assert.match(normalized, /from pg_catalog\.pg_timezone_names/);
  assert.match(normalized, /at time zone v_timezone\)::date = p_business_date/);
  assert.match(normalized, /from public\.get_finance_day_summary\(p_business_date, p_timezone\)/);
});

test('finance timezone RPCs remain protected from anon', () => {
  assert.match(normalized, /revoke execute on function public\.get_finance_day_summary\(date, text\) from public, anon/);
  assert.match(normalized, /grant execute on function public\.get_finance_day_summary\(date, text\) to authenticated/);
  assert.match(normalized, /revoke execute on function public\.save_cash_closure_draft\(date, numeric, numeric, numeric, numeric, numeric, text, text\) from public, anon/);
  assert.match(normalized, /revoke execute on function public\.close_cash_closure\(date, numeric, numeric, numeric, numeric, numeric, text, text\) from public, anon/);
});

test('finance page sends browser timezone to summary and closure RPCs', () => {
  assert.match(financePage, /Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/);
  assert.match(financePage, /p_timezone: getBusinessTimeZone\(\)/);
  assert.match(financePage, /setBusinessDate\(event\.target\.value \|\| todayLocalDate\(\)\)/);
});
