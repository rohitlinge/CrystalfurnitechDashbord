import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:4173';
const logs = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));

await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);
await page.click('#demo-admin');
await page.waitForTimeout(15000);

const rest403 = logs.filter((l) => l.includes('403') || l.includes('PERMISSION_DENIED'));
const debug = await page.evaluate(() => sessionStorage.getItem('cf_debug_a1718d'));
const body = await page.locator('body').innerText().then((t) => t.includes('ALL DEALERS'));

await browser.close();

console.log(JSON.stringify({
  url,
  adminDashboardLoaded: body,
  rest403Count: rest403.length,
  rest403Samples: rest403.slice(0, 5),
  debug: debug ? JSON.parse(debug).slice(-5) : null,
}, null, 2));
