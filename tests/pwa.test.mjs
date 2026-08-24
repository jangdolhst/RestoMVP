import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const readRoot = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const publicFileExists = (path) => existsSync(new URL(`../public/${path}`, import.meta.url));

test('web app manifest makes Jamm Free installable from the homepage', () => {
  const manifest = JSON.parse(readRoot('public/manifest.webmanifest'));

  assert.equal(manifest.name, 'Jamm Free');
  assert.equal(manifest.short_name, 'Jamm Free');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.background_color, '#0B0F19');
  assert.equal(manifest.theme_color, '#0B0F19');
  assert.equal(manifest.id, '/');
  assert.equal(manifest.icons.some((icon) => icon.sizes === '192x192' && icon.purpose.includes('maskable')), true);
  assert.equal(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose.includes('any')), true);

  for (const icon of manifest.icons) {
    assert.equal(publicFileExists(icon.src.replace(/^\//, '')), true, `${icon.src} must exist`);
  }
});

test('index html exposes install metadata for browser and iOS homescreen', () => {
  const html = readRoot('index.html');

  assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest" \/>/);
  assert.match(html, /<link rel="apple-touch-icon" href="\/assets\/pwa-icon-192\.png" \/>/);
  assert.match(html, /<meta name="mobile-web-app-capable" content="yes" \/>/);
  assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes" \/>/);
  assert.match(html, /<meta name="apple-mobile-web-app-title" content="Jamm Free" \/>/);
});

test('service worker is registered safely and avoids sensitive runtime data', () => {
  const main = readRoot('src/main.jsx');
  const serviceWorker = readRoot('public/sw.js');

  assert.match(main, /registerServiceWorker\(\)/);
  assert.match(serviceWorker, /NETWORK_ONLY_HOSTS/);
  assert.match(serviceWorker, /supabase\.co/);
  assert.match(serviceWorker, /request\.mode === 'navigate'/);
  assert.doesNotMatch(serviceWorker, /caches\.open\([^)]*\)[\s\S]*supabase/);
  assert.doesNotMatch(serviceWorker, /localStorage|sessionStorage|Authorization|apikey/i);
});

test('vercel serves pwa files with explicit cache headers before spa fallback', () => {
  const vercelConfig = readRoot('vercel.json');

  assert.match(vercelConfig, /"source": "\/sw\.js"/);
  assert.match(vercelConfig, /"Cache-Control", "value": "no-cache, no-store, must-revalidate"/);
  assert.match(vercelConfig, /"source": "\/manifest\.webmanifest"/);
});
