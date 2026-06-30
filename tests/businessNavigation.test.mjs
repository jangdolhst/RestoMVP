import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BUSINESS_NAV_ITEMS,
  shouldShowBusinessBottomNav,
} from '../src/lib/businessNavigation.js';

test('business bottom navigation exposes the main restaurant panel routes', () => {
  assert.deepEqual(
    BUSINESS_NAV_ITEMS.map((item) => item.path),
    ['/pos', '/pagos', '/finanzas', '/settings']
  );
});

test('business bottom navigation only appears on business layout routes', () => {
  assert.equal(shouldShowBusinessBottomNav('/pos'), true);
  assert.equal(shouldShowBusinessBottomNav('/pagos'), true);
  assert.equal(shouldShowBusinessBottomNav('/finanzas'), true);
  assert.equal(shouldShowBusinessBottomNav('/settings'), true);

  assert.equal(shouldShowBusinessBottomNav('/'), false);
  assert.equal(shouldShowBusinessBottomNav('/menu/tenant-1'), false);
  assert.equal(shouldShowBusinessBottomNav('/login'), false);
  assert.equal(shouldShowBusinessBottomNav('/cocina'), false);
});
