import { chromium } from 'playwright';

const url = process.argv[2] || 'https://crystalfurnitech-dashbord.vercel.app';
const scenario = process.argv[3] || 'dealer-approved';

const scenarios = {
  'dealer-approved': { email: 'dealer.approved@crystalfurnitech.com', password: 'dealer123' },
  admin: { email: 'admin@crystalfurnitech.com', password: 'admin123' },
};

const creds = scenarios[scenario] || scenarios['dealer-approved'];
const logs = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));

await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);

await page.fill('#login-email', creds.email);
await page.fill('#login-password', creds.password);
await page.click('#btn-login-submit');
await page.waitForTimeout(20000);

const errorText = await page.locator('#login-error').textContent().catch(() => null);
const statusText = await page.locator('#status-alert-box').textContent().catch(() => null);
const afterDebug = await page.evaluate(() => sessionStorage.getItem('cf_debug_a1718d'));
const bodySnippet = await page.locator('body').innerText().then((t) => t.slice(0, 600)).catch(() => '');

await browser.close();

console.log(JSON.stringify({
  url,
  scenario,
  creds: creds.email,
  errorText,
  statusText,
  afterDebug: afterDebug ? JSON.parse(afterDebug) : null,
  consoleLogs: logs.filter((l) => !l.includes('127.0.0.1:7326')).slice(-20),
  bodySnippet,
}, null, 2));
