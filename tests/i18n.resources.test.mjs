import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  resources,
} from '../src/i18n/resources/index.js';

const criticalKeys = [
  'common.language.es',
  'common.language.en',
  'marketplace.hero.badge',
  'marketplace.hero.titlePrefix',
  'marketplace.actions.usePreciseLocation',
  'marketplace.categories.mexican',
  'marketplace.categories.arabic',
  'location.errors.approximateUnavailable',
  'location.errors.gpsDenied',
  'settings.toggleVisibility',
  'settings.weekDaysShort.monday',
  'navigation.orders',
  'auth.login',
  'auth.forgotPassword',
  'auth.resetEmailSent',
  'auth.newPasswordTitle',
  'auth.showPassword',
  'orders.title',
  'payments.activeTitle',
  'payments.activeEmptyTitle',
  'premium.badge',
  'reviews.title',
  'reviews.viewReviews',
  'reviews.writeReview',
  'reviews.onlyPaidOrders',
  'reviews.orderNotPaid',
  'reviews.alreadyReviewed',
  'reviews.submitReview',
  'reviews.thanks',
  'reviews.noReviews',
  'reviews.reviewCountShort',
  'reviews.starLabel',
  'premium.features.paymentHistory.title',
  'premium.features.fiscalData.title',
];

const getPath = (object, path) =>
  path.split('.').reduce((current, segment) => current?.[segment], object);

test('i18n exposes Spanish as the default language', () => {
  assert.equal(DEFAULT_LANGUAGE, 'es');
  assert.deepEqual(SUPPORTED_LANGUAGES, ['es', 'en']);
});

test('Spanish and English resources define critical UI keys', () => {
  for (const language of SUPPORTED_LANGUAGES) {
    assert.ok(resources[language]?.translation, `${language} translation resource missing`);

    for (const key of criticalKeys) {
      assert.equal(
        typeof getPath(resources[language].translation, key),
        'string',
        `${language}.${key} must be a string`
      );
    }
  }
});
