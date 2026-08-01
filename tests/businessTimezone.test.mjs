import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_BUSINESS_TIMEZONE,
  deriveBusinessTimeZone,
  normalizeBusinessTimeZone,
} from '../src/lib/businessTimezone.js';

test('derives Mexico business timezone from restaurant coordinates', () => {
  assert.equal(deriveBusinessTimeZone(32.5149, -117.0382), 'America/Tijuana');
  assert.equal(deriveBusinessTimeZone(19.4326, -99.1332), 'America/Mexico_City');
  assert.equal(deriveBusinessTimeZone(21.1619, -86.8515), 'America/Cancun');
  assert.equal(deriveBusinessTimeZone(29.0729, -110.9559), 'America/Hermosillo');
  assert.equal(deriveBusinessTimeZone(23.2494, -106.4111), 'America/Mazatlan');
});

test('falls back to the default business timezone for invalid coordinates', () => {
  assert.equal(DEFAULT_BUSINESS_TIMEZONE, 'America/Tijuana');
  assert.equal(deriveBusinessTimeZone(null, -117), DEFAULT_BUSINESS_TIMEZONE);
  assert.equal(deriveBusinessTimeZone(32, Number.NaN), DEFAULT_BUSINESS_TIMEZONE);
  assert.equal(deriveBusinessTimeZone('32', '-117'), DEFAULT_BUSINESS_TIMEZONE);
});

test('normalizes unsupported or empty timezone values', () => {
  assert.equal(normalizeBusinessTimeZone('America/Mexico_City'), 'America/Mexico_City');
  assert.equal(normalizeBusinessTimeZone(''), DEFAULT_BUSINESS_TIMEZONE);
  assert.equal(normalizeBusinessTimeZone('Europe/Madrid'), DEFAULT_BUSINESS_TIMEZONE);
  assert.equal(normalizeBusinessTimeZone(null, 'America/Cancun'), 'America/Cancun');
});
