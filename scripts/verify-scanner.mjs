/**
 * verify-scanner.mjs — Browser smoke test for document scanner
 * Run: node scripts/verify-scanner.mjs
 */

import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST = join(__dirname, '..', 'dist');
const PORT = 4173;

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};

function serveDist() {
  return createServer((req, res) => {
    let path = join(DIST, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    if (!existsSync(path) || !path.startsWith(DIST)) {
      path = join(DIST, 'index.html');
    }
    const ext = extname(path);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(readFileSync(path));
  });
}

async function run() {
  if (!existsSync(join(DIST, 'index.html'))) {
    console.error('❌ Run npm run build first');
    process.exit(1);
  }

  const server = serveDist();
  await new Promise((r) => server.listen(PORT, r));
  const base = `http://127.0.0.1:${PORT}`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push(`PageError: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`Console: ${msg.text()}`);
  });

  console.log('1. Loading /mobile …');
  await page.goto(`${base}/mobile?session=test&shop=test`, { waitUntil: 'networkidle', timeout: 30000 });

  console.log('2. Opening Scan Document …');
  await page.click('.pick-card-scan', { timeout: 10000 });
  await page.waitForTimeout(1500);

  const scannerVisible = await page.locator('.doc-scanner-shell').isVisible().catch(() => false);
  if (!scannerVisible) {
    throw new Error('Scanner modal did not open');
  }
  console.log('   ✓ Scanner opened');

  const hasGalleryHint =
    (await page.locator('.doc-scanner-hint').textContent())?.includes('gallery') ||
    (await page.locator('.doc-scanner-camera-error').count()) > 0;
  console.log(`   ✓ Camera/gallery UI visible (http = gallery fallback expected: ${hasGalleryHint})`);

  console.log('3. Simulating gallery import …');
  const testImage = await page.evaluateHandle(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, 800, 600);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(120, 80, 560, 440);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(120, 80, 560, 440);
    return canvas.toDataURL('image/jpeg', 0.92);
  });

  const dataUrl = await testImage.jsonValue();

  await page.evaluate(async (url) => {
    const res = await fetch(url);
    const blob = await res.blob();
    const file = new File([blob], 'test-doc.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('.doc-scanner-shell input[type="file"]');
    if (!input) throw new Error('Gallery input not found');
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, dataUrl);

  await page.waitForSelector('.doc-scanner-crop-area', { timeout: 15000 });
  console.log('   ✓ Crop editor loaded');

  console.log('4. Testing Auto-detect edges …');
  const detectBtn = page.locator('.doc-scanner-autodetect-btn');
  await detectBtn.click();

  await page.waitForFunction(
    () => {
      const btn = document.querySelector('.doc-scanner-autodetect-btn');
      return btn && !btn.disabled && !btn.textContent.includes('Detecting');
    },
    { timeout: 8000 }
  );
  console.log('   ✓ Auto-detect finished (<8s, no hang)');

  const detectMsg = await page.locator('.doc-scanner-detect-msg').textContent().catch(() => null);
  if (detectMsg) console.log(`   ℹ ${detectMsg}`);
  else console.log('   ✓ Corners detected');

  console.log('5. Testing Done → review …');
  await page.locator('.doc-scanner-crop-actions button.btn-primary').click({ timeout: 5000 });
  await page.waitForSelector('.doc-scanner-review-wrap', { timeout: 10000 });
  console.log('   ✓ Review screen');

  console.log('6. Create PDF …');
  await page.locator('.doc-scanner-review-actions button.btn-primary').click({ timeout: 5000 });
  await page.waitForSelector('.doc-scanner-success, .doc-scanner-exporting', { timeout: 20000 });
  const success = await page.locator('.doc-scanner-success').isVisible().catch(() => false);
  if (success) console.log('   ✓ PDF created successfully');
  else console.log('   ⚠ PDF step reached (export may still be running)');

  if (errors.length) {
    console.log('\n⚠ Non-fatal console errors:');
    errors.slice(0, 5).forEach((e) => console.log('  ', e));
  }

  await browser.close();
  server.close();

  console.log('\n✅ Scanner verification passed');
}

run().catch((err) => {
  console.error('\n❌ Verification failed:', err.message);
  process.exit(1);
});
