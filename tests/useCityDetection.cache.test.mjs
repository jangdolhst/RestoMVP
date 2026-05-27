import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LOCATION_CACHE_KEY,
  getUsableCachedLocation,
} from '../src/hooks/useCityDetection.js';

test('uses the versioned location cache key', () => {
  assert.equal(LOCATION_CACHE_KEY, 'jf_user_location_v2');
});

test('accepts fresh gps cache and rejects expired ip cache', () => {
  const now = 1_000_000;
  const gpsCache = JSON.stringify({
    city: 'Tijuana',
    state: 'BC',
    country: 'MX',
    lat: 32.5149,
    lng: -117.0382,
    source: 'gps',
    timestamp: now - 1_000,
  });
  const expiredIpCache = JSON.stringify({
    city: 'San Diego',
    state: 'CA',
    country: 'US',
    lat: 32.7157,
    lng: -117.1611,
    source: 'ip',
    timestamp: now - 6 * 60 * 1_000,
  });

  assert.equal(getUsableCachedLocation(gpsCache, now)?.source, 'gps');
  assert.equal(getUsableCachedLocation(expiredIpCache, now), null);
});
