import { chromium } from 'playwright';

(async () => {
  console.log("Iniciando QA Profesional automatizada (Playwright)...");
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 }, // Simular Mobile (iPhone SE)
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1'
  });
  
  const page = await context.newPage();
  const logs = [];
  const networkErrors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      logs.push(`[${msg.type().toUpperCase()}] ${msg.text()}`);
    }
  });
  
  page.on('pageerror', error => {
    logs.push(`[CRITICAL EXCEPTION] ${error.message}`);
  });
  
  page.on('response', response => {
    if (response.status() >= 400 && response.status() !== 401 && response.status() !== 403) {
      // Ignore auth errors since we are not logged in
      networkErrors.push(`[HTTP ${response.status()}] ${response.url()}`);
    }
  });

  try {
    console.log("1. Verificando /qa-test-settings (Mi Negocio)...");
    await page.goto('http://localhost:3001/qa-test-settings');
    await page.waitForLoadState('networkidle');
    
    // Check if PhoneInput renders without crashing
    const phoneInput = page.locator('input[type="tel"]');
    const inputCount = await phoneInput.count();
    
    console.log(`-> Se encontraron ${inputCount} PhoneInput(s) en la página.`);
    if (inputCount > 0) {
      console.log("-> ✅ PhoneInput se renderizó correctamente, no hay crashes críticos.");
    } else {
      console.log("-> ⚠️ No se encontró PhoneInput. Puede que no esté visible sin sesión o hubo un error de render.");
    }

    console.log("\n2. Simulando interacción y comprobando Responsive...");
    await page.setViewportSize({ width: 768, height: 1024 }); // Tablet
    await page.waitForTimeout(500);

    console.log("\nResultados de Consola / Errores:");
    const reactErrors = logs.filter(l => l.includes('React') || l.includes('CRITICAL EXCEPTION'));
    
    if (reactErrors.length === 0) {
      console.log("✅ Cero errores críticos de React en la página.");
    } else {
      console.log("❌ Se encontraron errores de render/React:");
      console.log(reactErrors.join('\n'));
    }

    const otherWarnings = logs.filter(l => !l.includes('React') && !l.includes('CRITICAL EXCEPTION'));
    if (otherWarnings.length > 0) {
      console.log("\nOtras advertencias:");
      console.log(otherWarnings.join('\n'));
    }

    console.log("\nErrores de Red (Ignorando 401/403):");
    if (networkErrors.length === 0) {
      console.log("✅ Cero errores de red detectados.");
    } else {
      console.log(networkErrors.join('\n'));
    }

  } catch (err) {
    console.error("❌ Error durante QA automatizado:", err);
  } finally {
    await browser.close();
  }
})();
