import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getOrderAgeMeta,
  getStaleOrders,
  groupOrdersByBusinessDate,
} from '../src/lib/orderGrouping.js';

test('groupOrdersByBusinessDate groups pending charge orders by local order date newest first', () => {
  const orders = [
    { id: 'old', orderNumber: 1, createdAt: '2026-06-27T18:00:00.000Z' },
    { id: 'today', orderNumber: 1, createdAt: '2026-06-29T20:00:00.000Z' },
    { id: 'yesterday', orderNumber: 1, createdAt: '2026-06-28T20:00:00.000Z' },
  ];

  const groups = groupOrdersByBusinessDate(orders, new Date('2026-06-29T21:00:00.000Z'));

  assert.deepEqual(
    groups.map((group) => ({
      key: group.key,
      count: group.orders.length,
      orderIds: group.orders.map((order) => order.id),
    })),
    [
      { key: '2026-06-29', count: 1, orderIds: ['today'] },
      { key: '2026-06-28', count: 1, orderIds: ['yesterday'] },
      { key: '2026-06-27', count: 1, orderIds: ['old'] },
    ]
  );
});

test('getOrderAgeMeta labels today yesterday old and very old orders', () => {
  assert.equal(getOrderAgeMeta('2026-06-29T08:00:00.000Z', new Date('2026-06-29T21:00:00.000Z')).key, 'today');
  assert.equal(getOrderAgeMeta('2026-06-28T08:00:00.000Z', new Date('2026-06-29T21:00:00.000Z')).key, 'yesterday');
  assert.equal(getOrderAgeMeta('2026-06-25T08:00:00.000Z', new Date('2026-06-29T21:00:00.000Z')).key, 'old');
  assert.equal(getOrderAgeMeta('2026-06-19T08:00:00.000Z', new Date('2026-06-29T21:00:00.000Z')).key, 'veryOld');
});

test('getStaleOrders returns only orders older than the stale threshold', () => {
  const orders = [
    { id: 'recent', createdAt: '2026-06-27T08:00:00.000Z' },
    { id: 'old', createdAt: '2026-06-19T08:00:00.000Z' },
    { id: 'very-old', createdAt: '2026-05-22T08:00:00.000Z' },
  ];

  assert.deepEqual(
    getStaleOrders(orders, new Date('2026-06-29T21:00:00.000Z')).map((order) => order.id),
    ['old', 'very-old']
  );
});
