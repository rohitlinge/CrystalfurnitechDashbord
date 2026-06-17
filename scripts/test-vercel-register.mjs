import { chromium } from 'playwright';

const url = process.argv[2] || 'https://crystalfurnitech-dashbord.vercel.app';
const email = `test.dealer.${Date.now()}@crystalfurnitech.com`;
const logs = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));

await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.click('#btn-p-reg');
await page.waitForTimeout(1500);

await page.fill('#companyName', 'Test Furniture Co');
await page.fill('#ownerName', 'Test Owner');
await page.fill('#mobile', '9876543210');
await page.fill('#email', email);
await page.fill('#gstNumber', '27AAAAA1111A1Z1');
await page.fill('#city', 'Nagpur');
await page.selectOption('#state', 'Maharashtra');
await page.fill('#address', '123 Test Industrial Area Nagpur');
await page.fill('#password', 'dealer123');
await page.fill('#confirmPassword', 'dealer123');
await page.click('#btn-submit-registration');
await page.waitForTimeout(20000);

const errorText = await page.locator('#register-error, .text-\\[\\#ef4444\\]').first().textContent().catch(() => null);
const afterDebug = await page.evaluate(() => sessionStorage.getItem('cf_debug_a1718d'));
const bodySnippet = await page.locator('body').innerText().then((t) => t.slice(0, 700)).catch(() => '');

await browser.close();

console.log(JSON.stringify({
  url,
  email,
  errorText,
  afterDebug: afterDebug ? JSON.parse(afterDebug) : null,
  consoleLogs: logs.filter((l) => !l.includes('127.0.0.1:7326')).slice(-25),
  bodySnippet,
}, null, 2));
