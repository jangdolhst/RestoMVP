import assert from 'node:assert/strict';
import test from 'node:test';

import {
  shouldClearSubscriptionForAuthEvent,
  shouldRefetchSubscriptionForAuthEvent,
} from '../src/lib/authEvents.js';

test('token refresh does not refetch subscription for the same user', () => {
  assert.equal(
    shouldRefetchSubscriptionForAuthEvent({
      event: 'TOKEN_REFRESHED',
      currentUserId: 'restaurant-1',
      nextUserId: 'restaurant-1',
    }),
    false
  );
});

test('same-user signed in event does not refetch subscription', () => {
  assert.equal(
    shouldRefetchSubscriptionForAuthEvent({
      event: 'SIGNED_IN',
      currentUserId: 'restaurant-1',
      nextUserId: 'restaurant-1',
    }),
    false
  );
});

test('new user auth event refetches subscription', () => {
  assert.equal(
    shouldRefetchSubscriptionForAuthEvent({
      event: 'SIGNED_IN',
      currentUserId: null,
      nextUserId: 'restaurant-1',
    }),
    true
  );
});

test('signed out clears subscription', () => {
  assert.equal(shouldClearSubscriptionForAuthEvent({ event: 'SIGNED_OUT', nextUserId: null }), true);
  assert.equal(shouldClearSubscriptionForAuthEvent({ event: 'TOKEN_REFRESHED', nextUserId: 'restaurant-1' }), false);
});
