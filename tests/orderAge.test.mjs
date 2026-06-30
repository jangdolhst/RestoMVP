import assert from 'node:assert/strict';
import test from 'node:test';

import { getElapsedOrderAge } from '../src/lib/orderAge.js';

test('getElapsedOrderAge uses minutes under one hour', () => {
  assert.deepEqual(
    getElapsedOrderAge('2026-06-29T20:45:00.000Z', new Date('2026-06-29T21:00:00.000Z')),
    { unit: 'minutes', count: 15, totalMinutes: 15 }
  );
});

test('getElapsedOrderAge uses hours under one day', () => {
  assert.deepEqual(
    getElapsedOrderAge('2026-06-29T18:00:00.000Z', new Date('2026-06-29T21:30:00.000Z')),
    { unit: 'hours', count: 3, totalMinutes: 210 }
  );
});

test('getElapsedOrderAge uses days for old kitchen orders', () => {
  assert.deepEqual(
    getElapsedOrderAge('2026-05-22T20:00:00.000Z', new Date('2026-06-29T20:00:00.000Z')),
    { unit: 'days', count: 38, totalMinutes: 54720 }
  );
});
