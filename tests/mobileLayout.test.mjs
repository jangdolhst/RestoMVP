import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const posPage = readFileSync(new URL('../src/pages/POSPage.jsx', import.meta.url), 'utf8');

test('POS mobile ticket bar is offset above the business bottom navigation', () => {
  assert.match(posPage, /bottom-\[calc\(env\(safe-area-inset-bottom\)\+5\.9rem\)\]/);
  assert.doesNotMatch(posPage, /fixed bottom-0 left-0 right-0 p-4/);
});
