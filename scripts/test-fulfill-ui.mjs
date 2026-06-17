import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:3000';
const logs = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));

await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.fill('#login-email', 'admin@crystalfurnitech.com');
await page.fill('#login-password', 'admin123');
await page.click('#btn-login-submit');
await page.waitForTimeout(15000);

const stockTab = page.getByRole('button', { name: /Stock Requests/i });
if (await stockTab.count()) await stockTab.click();
await page.waitForTimeout(3000);

const fulfillBtn = page.locator('button[id^="btn-fulfill-"]').first();
const fulfillCount = await fulfillBtn.count();
let beforeStatus = null;
let afterStatus = null;
let clicked = false;

if (fulfillCount) {
  const row = fulfillBtn.locator('xpath=ancestor::tr');
  beforeStatus = await row.locator('td').nth(5).innerText().catch(() => null);
  await fulfillBtn.click();
  clicked = true;
  await page.waitForTimeout(15000);
  afterStatus = await row.locator('td').nth(5).innerText().catch(() => null);
}

const body = await page.locator('body').innerText().catch(() => '');

await browser.close();

console.log(JSON.stringify({
  url,
  fulfillCount,
  clicked,
  beforeStatus,
  afterStatus,
  statusChanged: beforeStatus !== afterStatus,
  errorLogs: logs.filter((l) =>
    /error|permission|Admin session|Insufficient|timed out|failed/i.test(l)
  ),
  recentLogs: logs.slice(-20),
  hasVisibleError: /Firestore denied|Failed|timed out/i.test(body),
}, null, 2));
