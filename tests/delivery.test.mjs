import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DELIVERY_FEE_MODES,
  DELIVERY_SERVICE_MODES,
  calculateDeliveryFee,
  calculateDistanceKm,
  canUseFulfillment,
  normalizeDeliverySettings,
} from '../src/lib/delivery.js';

test('exports the supported delivery modes', () => {
  assert.deepEqual(DELIVERY_SERVICE_MODES, [
    'pickup_only',
    'delivery_only',
    'pickup_and_delivery',
  ]);
  assert.deepEqual(DELIVERY_FEE_MODES, ['free', 'fixed', 'per_km', 'manual']);
});

test('normalizes delivery settings and falls back for unknown modes', () => {
  assert.deepEqual(normalizeDeliverySettings({
    delivery_service_mode: 'unknown',
    delivery_fee_mode: 'unknown',
    delivery_fixed_fee_mxn: '35.239',
    delivery_base_fee_mxn: -2,
    delivery_fee_per_km_mxn: '10.239',
    delivery_max_distance_km: '8.44',
    delivery_min_order_mxn: '100.129',
    delivery_eta_min_minutes: '20',
    delivery_eta_max_minutes: '45.8',
  }), {
    delivery_service_mode: 'pickup_only',
    delivery_fee_mode: 'manual',
    delivery_fixed_fee_mxn: 35.24,
    delivery_base_fee_mxn: 0,
    delivery_fee_per_km_mxn: 10.24,
    delivery_max_distance_km: 8.4,
    delivery_min_order_mxn: 100.13,
    delivery_eta_min_minutes: 20,
    delivery_eta_max_minutes: 45.8,
  });
});

test('allows only the fulfillment types configured by the service mode', () => {
  assert.equal(canUseFulfillment({ delivery_service_mode: 'pickup_only' }, 'pickup'), true);
  assert.equal(canUseFulfillment({ delivery_service_mode: 'pickup_only' }, 'delivery'), false);
  assert.equal(canUseFulfillment({ delivery_service_mode: 'delivery_only' }, 'pickup'), false);
  assert.equal(canUseFulfillment({ delivery_service_mode: 'delivery_only' }, 'delivery'), true);
  assert.equal(canUseFulfillment({ delivery_service_mode: 'pickup_and_delivery' }, 'pickup'), true);
  assert.equal(canUseFulfillment({ delivery_service_mode: 'pickup_and_delivery' }, 'delivery'), true);
  assert.equal(canUseFulfillment({ delivery_service_mode: 'pickup_and_delivery' }, 'other'), false);
});

test('calculates rounded distance in kilometers', () => {
  assert.equal(calculateDistanceKm(
    { latitude: 32.6101, longitude: -115.4494 },
    { latitude: 32.6245, longitude: -115.4523 },
  ), 1.6);
});

test('returns null for invalid distance coordinates', () => {
  assert.equal(calculateDistanceKm(null, { latitude: 32, longitude: -115 }), null);
  assert.equal(calculateDistanceKm({ latitude: 'bad', longitude: -115 }, { latitude: 32, longitude: -115 }), null);
});

test('calculates a free delivery fee', () => {
  assert.deepEqual(calculateDeliveryFee({ delivery_fee_mode: 'free' }, 4.2), {
    fee: 0,
    distanceKm: 4.2,
    status: 'confirmed',
    reason: null,
  });
});

test('calculates a fixed delivery fee', () => {
  assert.deepEqual(calculateDeliveryFee({ delivery_fee_mode: 'fixed', delivery_fixed_fee_mxn: 35 }, 4.2), {
    fee: 35,
    distanceKm: 4.2,
    status: 'confirmed',
    reason: null,
  });
});

test('requires manual delivery fees when configured', () => {
  assert.deepEqual(calculateDeliveryFee({ delivery_fee_mode: 'manual' }, 4.2), {
    fee: null,
    distanceKm: 4.2,
    status: 'pending_manual',
    reason: 'manual_fee_required',
  });
});

test('calculates a per-kilometer delivery fee', () => {
  assert.deepEqual(calculateDeliveryFee({
    delivery_fee_mode: 'per_km',
    delivery_base_fee_mxn: 20,
    delivery_fee_per_km_mxn: 10,
  }, 3.4), {
    fee: 54,
    distanceKm: 3.4,
    status: 'confirmed',
    reason: null,
  });
});

test('requires distance for per-kilometer fees', () => {
  assert.deepEqual(calculateDeliveryFee({ delivery_fee_mode: 'per_km' }, null), {
    fee: null,
    distanceKm: null,
    status: 'not_applicable',
    reason: 'distance_required',
  });
});

test('rejects delivery beyond the configured radius', () => {
  assert.deepEqual(calculateDeliveryFee({
    delivery_fee_mode: 'free',
    delivery_max_distance_km: 5,
  }, 5.1), {
    fee: null,
    distanceKm: 5.1,
    status: 'not_applicable',
    reason: 'outside_delivery_radius',
  });
});
