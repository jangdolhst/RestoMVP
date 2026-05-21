import { chromium } from 'playwright';
import { spawn } from 'child_process';

const server = spawn('npm', ['run', 'preview'], {
  cwd: process.cwd(),
  stdio: 'pipe',
  shell: true
});

let serverReady = false;

server.stdout.on('data', async (data) => {
  const output = data.toString();
  console.log(output);
  const cleanOutput = output.replace(/\x1b\[.*?m/g, '');
  const match = cleanOutput.match(/localhost:(\d+)/);
  if (match && !serverReady) {
    serverReady = true;
    const port = match[1];
    
    const browser = await chromium.launch();
    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    console.log('Navigating to settings...');
    await page.goto(`http://localhost:${port}/test-settings`, { waitUntil: 'networkidle' });
    
    // Wait a bit to ensure it has time to render and crash
    await page.waitForTimeout(3000);
    
    const html = await page.content();
    const fs = await import('fs');
    fs.writeFileSync('page.html', html);
    await browser.close();
    server.kill();
    process.exit(0);
  }
});

setTimeout(() => {
  if (!serverReady) {
    console.log('Server not ready after 15 seconds');
    server.kill();
    process.exit(1);
  }
}, 15000);
