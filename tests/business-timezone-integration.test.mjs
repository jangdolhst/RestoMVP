import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readSource = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const migration = readSource('../migrations/015_restaurant_business_timezone.sql');
const normalizedMigration = migration.replace(/\s+/g, ' ').toLowerCase();
const settingsPage = readSource('../src/pages/SettingsPage.jsx');
const financePage = readSource('../src/pages/FinancePage.jsx');
const posContext = readSource('../src/context/POSContext.jsx');
const es = readSource('../src/i18n/resources/es.js');
const en = readSource('../src/i18n/resources/en.js');

test('migration stores a persistent business timezone on restaurant profiles', () => {
  assert.match(normalizedMigration, /alter table public\.restaurant_profiles add column if not exists business_timezone text not null default 'america\/tijuana'/);
  assert.match(normalizedMigration, /grant update \(business_timezone, updated_at\) on table public\.restaurant_profiles to authenticated/);
  assert.match(normalizedMigration, /notify pgrst, 'reload schema'/);
});

test('settings derives and saves timezone whenever restaurant coordinates change', () => {
  assert.match(settingsPage, /deriveBusinessTimeZone/);
  assert.match(settingsPage, /normalizeBusinessTimeZone/);
  assert.match(settingsPage, /business_timezone/);
  assert.match(settingsPage, /settings\.businessTimezone/);
  assert.match(settingsPage, /settings\.businessTimezoneHelp/);
});

test('finance uses restaurant profile timezone instead of browser-only timezone', () => {
  assert.match(posContext, /business_timezone/);
  assert.match(financePage, /usePOS/);
  assert.match(financePage, /restaurantProfile\?\.business_timezone/);
  assert.match(financePage, /p_timezone: businessTimezone/);
});

test('business timezone labels exist in both languages', () => {
  assert.match(es, /businessTimezone:/);
  assert.match(es, /businessTimezoneHelp:/);
  assert.match(en, /businessTimezone:/);
  assert.match(en, /businessTimezoneHelp:/);
});
