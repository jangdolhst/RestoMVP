import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';

const TARGET_URL = process.env.TEST_CONSOLE_URL || 'http://localhost:5175/test-settings';

const isServerAvailable = async (url) => {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
};

test('settings page has no browser console errors when dev server is running', async (t) => {
  if (!(await isServerAvailable(TARGET_URL))) {
    t.skip(`Dev server not available at ${TARGET_URL}`);
    return;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  try {
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    assert.equal(errors.length, 0, errors.join('\n'));
  } finally {
    await browser.close();
  }
});
