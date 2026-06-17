import { chromium } from 'playwright';

const url = 'https://crystalfurnitech-dashbord.vercel.app';
const email = process.argv[2] || 'debug.dealer.1781642870167@crystalfurnitech.com';
const password = 'dealer123';
const logs = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('dialog', async (d) => {
  logs.push(`[alert] ${d.message()}`);
  await d.accept();
});

await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.fill('#login-email', email);
await page.fill('#login-password', password);
await page.click('#btn-login-submit');
await page.waitForTimeout(12000);

const indentBtn = page.getByRole('button', { name: /Submit Stock Indent/i }).first();
await indentBtn.click();
await page.waitForTimeout(1000);
await page.fill('input[type="number"]', '1');
await page.locator('form button[type="submit"]').click();
await page.waitForTimeout(8000);

const successText = await page.getByText(/Stock Indent Lodged|successfully/i).textContent().catch(() => null);
const alerts = logs.filter((l) => l.startsWith('[alert]'));
const permDenied = logs.filter((l) => l.includes('permission-denied') || l.includes('PERMISSION_DENIED'));
const body = await page.locator('body').innerText().then((t) => t.includes('Pending') || t.includes('Stock'));

await browser.close();
console.log(JSON.stringify({
  email,
  successText,
  alerts,
  permDeniedCount: permDenied.length,
  requirementsVisible: body,
  pass: !alerts.length && permDenied.length === 0 && (successText || body),
}, null, 2));
