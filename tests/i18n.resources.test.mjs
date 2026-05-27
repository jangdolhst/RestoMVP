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
  'navigation.orders',
  'auth.login',
  'orders.title',
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
