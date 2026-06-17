import { chromium } from 'playwright';
import { appendFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG = join(__dirname, '../debug-bbfd20.log');
const url = process.argv[2] || 'http://localhost:5173';
const email = process.argv[3] || 'debug.dealer.1781642870167@crystalfurnitech.com';
const password = 'dealer123';

function log(payload) {
  appendFileSync(LOG, JSON.stringify({ sessionId: 'bbfd20', timestamp: Date.now(), runId: 'white-screen', ...payload }) + '\n');
}

const logs = [];
const pageErrors = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', (msg) => {
  const text = `[${msg.type()}] ${msg.text()}`;
  logs.push(text);
  if (msg.type() === 'error') pageErrors.push(text);
});
page.on('pageerror', (err) => {
  const text = `[pageerror] ${err.message}`;
  pageErrors.push(text);
  log({ location: 'test-white-screen:pageerror', message: 'uncaught error', data: { error: err.message, stack: err.stack?.slice(0, 500) }, hypothesisId: 'F' });
});

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.fill('#login-email', email);
await page.fill('#login-password', password);
await page.click('#btn-login-submit');

await page.waitForTimeout(3000);
const afterLogin = await page.locator('body').innerText().then((t) => t.slice(0, 300));
log({ location: 'test-white-screen:afterLogin', message: '3s after login', data: { body: afterLogin, hasCatalog: afterLogin.includes('Search') || afterLogin.includes('Catalog') }, hypothesisId: 'F,G' });

await page.waitForTimeout(8000);
const beforeReload = await page.locator('body').innerText().then((t) => t.slice(0, 200));
log({ location: 'test-white-screen:beforeReload', message: 'before reload', data: { body: beforeReload }, hypothesisId: 'H' });

await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(12000);
const afterReload = await page.locator('body').innerText().then((t) => t.slice(0, 200));
const rootAfterReload = await page.locator('#root').innerHTML().then((h) => h.length);
log({ location: 'test-white-screen:afterReload', message: 'after reload', data: { body: afterReload, rootLen: rootAfterReload, pageErrors }, hypothesisId: 'H,I' });

await browser.close();
console.log(JSON.stringify({ beforeReload: beforeReload.slice(0, 120), afterReload: afterReload.slice(0, 120), rootAfterReload, pageErrors }, null, 2));
