import { chromium } from 'playwright';

const url = 'https://crystalfurnitech-dashbord.vercel.app';
const email = process.argv[2];
const password = 'dealer123';
if (!email) {
  console.error('Usage: node scripts/test-approved-dealer.mjs <dealer-email>');
  process.exit(1);
}

const logs = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));

// Admin login and approve dealer
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.click('#demo-admin');
await page.waitForTimeout(12000);

const approveBtn = page.locator('button').filter({ hasText: /^Approve$/i }).first();
if (await approveBtn.count()) {
  await approveBtn.click();
  await page.waitForTimeout(3000);
}

// Logout
await page.getByText('Sign Out').click();
await page.waitForTimeout(2000);

// Dealer login
await page.fill('#login-email', email);
await page.fill('#login-password', password);
await page.click('#btn-login-submit');
await page.waitForTimeout(15000);

const loginError = await page.locator('#login-error').textContent().catch(() => null);
const body = await page.locator('body').innerText().then((t) => t.slice(0, 600));
const rest403 = logs.filter((l) => l.includes('403') || l.includes('PERMISSION_DENIED'));
const debug = await page.evaluate(() => sessionStorage.getItem('cf_debug_a1718d'));

await browser.close();
console.log(JSON.stringify({
  email,
  loginError,
  dealerDashboardLoaded: body.includes('Products') || body.includes('Stock') || body.includes('Catalog'),
  rest403Count: rest403.length,
  bodySnippet: body,
  debug: debug ? JSON.parse(debug).slice(-4) : null,
}, null, 2));
