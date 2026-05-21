import { chromium } from 'playwright';

(async () => {
  console.log("Iniciando auditoría QA automatizada (Playwright)...");
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 }, // Simular Mobile (iPhone SE)
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1'
  });
  
  const page = await context.newPage();
  const logs = [];
  const networkRequests = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      logs.push(`[${msg.type().toUpperCase()}] ${msg.text()}`);
    }
  });
  
  page.on('pageerror', error => logs.push(`[CRITICAL EXCEPTION] ${error.message}`));
  
  page.on('request', request => {
    if (request.url().includes('supabase')) {
      networkRequests.push({ url: request.url(), method: request.method() });
    }
  });

  try {
    console.log("Visitando la landing page...");
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');
    
    console.log("Visitando el marketplace / menú (sin login)...");
    await page.goto('http://localhost:3000/menu/test-tenant');
    await page.waitForTimeout(1000);
    
    console.log("Navegando a ruta de login...");
    await page.goto('http://localhost:3000/login');
    await page.waitForTimeout(1000);
    
    console.log("Resultados de Consola / Errores:");
    if (logs.length === 0) console.log("✅ Cero errores o advertencias en consola.");
    else console.log(logs.join('\n'));
    
    console.log("\nPeticiones a Supabase detectadas:", networkRequests.length);
    
  } catch (err) {
    console.error("Error durante QA automatizado:", err);
  } finally {
    await browser.close();
  }
})();
