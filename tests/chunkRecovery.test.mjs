import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  CHUNK_RECOVERY_KEY,
  isChunkLoadError,
  recoverFromChunkLoadError,
} from '../src/utils/chunkRecovery.js';

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const createStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
};

test('detects stale Vite dynamic import and cache read failures', () => {
  assert.equal(
    isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://jamm-free.vercel.app/assets/POSPage-old.js')),
    true
  );
  assert.equal(isChunkLoadError(new Error('net::ERR_CACHE_READ_FAILURE')), true);
  assert.equal(isChunkLoadError(new Error('Regular application error')), false);
});

test('reloads only once per URL for a chunk load failure', () => {
  const storage = createStorage();
  let reloads = 0;
  const win = {
    location: {
      href: 'https://jamm-free.vercel.app/pos',
      reload: () => {
        reloads += 1;
      },
    },
    sessionStorage: storage,
  };
  const error = new TypeError('Failed to fetch dynamically imported module: /assets/POSPage-old.js');

  assert.equal(recoverFromChunkLoadError(error, { windowRef: win }), true);
  assert.equal(reloads, 1);
  assert.equal(storage.getItem(CHUNK_RECOVERY_KEY), win.location.href);

  assert.equal(recoverFromChunkLoadError(error, { windowRef: win }), false);
  assert.equal(reloads, 1);
});

test('app installs global chunk recovery and wraps lazy routes in an error boundary', () => {
  const main = readSource('src/main.jsx');
  const app = readSource('src/App.jsx');

  assert.match(main, /installChunkRecovery\(\)/);
  assert.match(app, /ChunkErrorBoundary/);
  assert.match(app, /<ChunkErrorBoundary>/);
});
