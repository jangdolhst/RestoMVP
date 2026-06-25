import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FREE_FEATURES,
  PREMIUM_FEATURES,
  hasFeature,
  isSubscriptionActive,
} from '../src/lib/features.js';

test('orders core features are free without a subscription', () => {
  assert.equal(hasFeature(null, FREE_FEATURES.receiveOrders), true);
  assert.equal(hasFeature(null, FREE_FEATURES.manualOrders), true);
  assert.equal(hasFeature(null, FREE_FEATURES.kitchen), true);
  assert.equal(hasFeature(null, FREE_FEATURES.menuManagement), true);
});

test('premium features require an active or unexpired subscription', () => {
  assert.equal(hasFeature(null, PREMIUM_FEATURES.printTickets), false);
  assert.equal(hasFeature({ status: 'canceled', current_period_end: '2020-01-01T00:00:00.000Z' }, PREMIUM_FEATURES.fiscalData), false);
  assert.equal(hasFeature({ status: 'active', current_period_end: '2020-01-01T00:00:00.000Z' }, PREMIUM_FEATURES.financialCalendar), true);
  assert.equal(hasFeature({ status: 'trialing', current_period_end: '2020-01-01T00:00:00.000Z' }, PREMIUM_FEATURES.paymentHistory), true);
  assert.equal(hasFeature({ status: 'past_due', current_period_end: '2999-01-01T00:00:00.000Z' }, PREMIUM_FEATURES.taxBreakdown), true);
});

test('unknown features are denied by default', () => {
  assert.equal(hasFeature({ status: 'active' }, 'unknownFeature'), false);
});

test('subscription active helper accepts active, trialing, or future period end', () => {
  const now = new Date('2026-06-24T12:00:00.000Z');
  assert.equal(isSubscriptionActive({ status: 'active' }, now), true);
  assert.equal(isSubscriptionActive({ status: 'trialing' }, now), true);
  assert.equal(isSubscriptionActive({ status: 'past_due', current_period_end: '2026-06-25T12:00:00.000Z' }, now), true);
  assert.equal(isSubscriptionActive({ status: 'canceled', current_period_end: '2026-06-23T12:00:00.000Z' }, now), false);
  assert.equal(isSubscriptionActive(null, now), false);
});
