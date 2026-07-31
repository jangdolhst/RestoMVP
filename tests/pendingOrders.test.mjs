import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  PENDING_CONFIRMATION_TIMEOUT_MINUTES,
  getPendingConfirmationAgeMinutes,
  splitPendingConfirmationOrders,
} from '../src/lib/pendingOrders.js';

test('pending confirmation timeout remains fifteen minutes', () => {
  assert.equal(PENDING_CONFIRMATION_TIMEOUT_MINUTES, 15);
});

test('getPendingConfirmationAgeMinutes floors elapsed minutes', () => {
  const now = new Date('2026-07-30T10:20:59.000Z');
  const createdAt = '2026-07-30T10:05:01.000Z';

  assert.equal(getPendingConfirmationAgeMinutes(createdAt, now), 15);
});

test('splitPendingConfirmationOrders keeps fresh orders and separates expired ones', () => {
  const now = new Date('2026-07-30T10:30:00.000Z');
  const orders = [
    { id: 'fresh', created_at: '2026-07-30T10:15:00.000Z' },
    { id: 'expired', created_at: '2026-07-30T10:14:59.000Z' },
    { id: 'invalid-date', created_at: 'not-a-date' },
  ];

  const result = splitPendingConfirmationOrders(orders, now);

  assert.deepEqual(result.fresh.map((order) => order.id), ['fresh', 'invalid-date']);
  assert.deepEqual(result.expired.map((order) => order.id), ['expired']);
  assert.equal(result.fresh[0].minutesElapsed, 15);
});

test('notifier and payments page share the same pending expiration helper', () => {
  const notifierSource = readFileSync(
    new URL('../src/components/ui/PendingOrderNotifier.jsx', import.meta.url),
    'utf8'
  );
  const paymentsSource = readFileSync(new URL('../src/pages/PagosPage.jsx', import.meta.url), 'utf8');

  assert.match(notifierSource, /splitPendingConfirmationOrders/);
  assert.match(paymentsSource, /splitPendingConfirmationOrders/);
});
