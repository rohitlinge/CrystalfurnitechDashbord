import { readFileSync, appendFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG = join(__dirname, '../debug-bbfd20.log');
const url = process.argv[2] || 'http://localhost:3000';

function log(payload) {
  appendFileSync(LOG, JSON.stringify({ sessionId: 'bbfd20', timestamp: Date.now(), runId: 'post-fix-tolowercase', ...payload }) + '\n');
}

const pageErrors = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (err) => pageErrors.push(err.message));
page.on('console', (msg) => { if (msg.type() === 'error') pageErrors.push(msg.text()); });

for (const [role, email, password] of [
  ['admin', 'admin@crystalfurnitech.com', 'admin123'],
  ['dealer', 'debug.dealer.1781642870167@crystalfurnitech.com', 'dealer123'],
]) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.click('#btn-login-submit');
  await page.waitForTimeout(10000);
  const body = await page.locator('body').innerText();
  const crashed = body.includes('Something went wrong loading the dashboard');
  log({ location: 'test-dashboard-crash', message: `${role} dashboard`, data: { role, crashed, hasErrorBoundary: crashed, pageErrors: pageErrors.slice(-5), bodySnippet: body.slice(0, 150) }, hypothesisId: 'K' });
  if (crashed) console.log('FAIL', role, pageErrors);
  else console.log('OK', role);
  await page.getByText('Sign Out').click().catch(() => page.locator('button[aria-label="Sign out"]').click());
  await page.waitForTimeout(2000);
}

await browser.close();
