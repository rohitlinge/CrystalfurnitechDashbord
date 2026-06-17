import { chromium } from 'playwright';

const url = process.argv[2] || 'https://crystalfurnitech-dashbord.vercel.app';
const email = `debug.dealer.${Date.now()}@crystalfurnitech.com`;
const password = 'dealer123';
const logs = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));

// Register
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.click('#btn-p-reg');
await page.waitForTimeout(1000);
await page.fill('#companyName', 'Debug Test Co');
await page.fill('#ownerName', 'Debug Owner');
await page.fill('#mobile', '9876543210');
await page.fill('#email', email);
await page.fill('#gstNumber', '27AAAAA1111A1Z1');
await page.fill('#city', 'Nagpur');
await page.selectOption('#state', 'Maharashtra');
await page.fill('#address', '123 Debug Street Nagpur Maharashtra');
await page.fill('#password', password);
await page.fill('#confirmPassword', password);
await page.click('#btn-submit-registration');
await page.waitForTimeout(15000);

const regError = await page.locator('#reg-error-msg').textContent().catch(() => null);

// Login as new dealer
await page.fill('#login-email', email);
await page.fill('#login-password', password);
await page.click('#btn-login-submit');
await page.waitForTimeout(15000);

const loginError = await page.locator('#login-error').textContent().catch(() => null);
const statusText = await page.locator('#status-alert-box').textContent().catch(() => null);
const debug = await page.evaluate(() => sessionStorage.getItem('cf_debug_a1718d'));
const rest403 = logs.filter((l) => l.includes('403') || l.includes('PERMISSION_DENIED'));

await browser.close();

console.log(JSON.stringify({
  url,
  email,
  regError,
  loginError,
  statusText,
  rest403Count: rest403.length,
  debug: debug ? JSON.parse(debug).filter((x) => x.location?.includes('login') || x.location?.includes('register')) : null,
}, null, 2));
