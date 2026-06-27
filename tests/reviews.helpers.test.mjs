import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatRating,
  getStoredOrderTokens,
  mapReviewError,
  mergeReviewSummaries,
} from '../src/lib/reviews.js';

const makeStorage = (value) => ({
  getItem: (key) => (key === 'resto_order_tokens' ? value : null),
});

test('getStoredOrderTokens supports legacy strings and token objects', () => {
  const tokens = getStoredOrderTokens(makeStorage(JSON.stringify([
    'legacy-token',
    { token: 'object-token', timestamp: Date.now() },
    { token: 'object-token', timestamp: Date.now() },
    { nope: true },
  ])));

  assert.deepEqual(tokens, ['legacy-token', 'object-token']);
});

test('formatRating returns one decimal or dash', () => {
  assert.equal(formatRating(4.333), '4.3');
  assert.equal(formatRating(null), '-');
  assert.equal(formatRating(undefined), '-');
});

test('mergeReviewSummaries attaches defaults for restaurants without reviews', () => {
  const restaurants = [{ id: 'r1', name: 'A' }, { id: 'r2', name: 'B' }];
  const summaries = [{ restaurant_id: 'r1', average_rating: 4.8, review_count: 7 }];

  assert.deepEqual(mergeReviewSummaries(restaurants, summaries), [
    { id: 'r1', name: 'A', reviewSummary: { average_rating: 4.8, review_count: 7 } },
    { id: 'r2', name: 'B', reviewSummary: { average_rating: null, review_count: 0 } },
  ]);
});

test('mapReviewError maps controlled RPC errors', () => {
  assert.equal(mapReviewError('order_not_paid'), 'orderNotPaid');
  assert.equal(mapReviewError('phone_mismatch'), 'phoneMismatch');
  assert.equal(mapReviewError('already_reviewed'), 'alreadyReviewed');
  assert.equal(mapReviewError('something else'), 'genericError');
});
