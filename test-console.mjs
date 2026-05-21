import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  
  console.log('Navigating to settings...');
  await page.goto('http://localhost:5175/test-settings', { waitUntil: 'networkidle' });
  
  await page.waitForTimeout(3000);
  
  const html = await page.content();
  console.log("HTML length:", html.length);
  
  await browser.close();
  process.exit(0);
})();
