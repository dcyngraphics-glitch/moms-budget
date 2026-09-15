const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const dir = 'C:/Users/bryan/Documents/Hermes/Projects/moms-budget';
const PORT = 8082;

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0].split('#')[0];
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(dir, urlPath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(err.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain' });
      res.end(err.code === 'ENOENT' ? 'Not found' : 'Error');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

const injectScript = function () {
  const data = {
    cashDrops: [
      { id: 'd1', date: '2026-09-15', amount: 15000, note: '15th salary' },
      { id: 'd2', date: '2026-09-30', amount: 15000, note: '30th salary' }
    ],
    bills: [
      { id: 'b1', name: 'Meralco Electric', amount: 2500, dueDate: '2026-09-20', category: 'utilities', paid: false, paidDate: null, note: 'Metered' },
      { id: 'b2', name: 'Water Bill', amount: 800, dueDate: '2026-09-25', category: 'utilities', paid: false, paidDate: null, note: '' },
      { id: 'b3', name: 'Internet PLDT', amount: 1499, dueDate: '2026-09-18', category: 'utilities', paid: false, paidDate: null, note: 'Fiber' }
    ],
    expenses: [
      { id: 'e1', date: '2026-09-16', amount: 2200, category: 'food', description: 'Grocery at SM', note: 'Weekly' },
      { id: 'e2', date: '2026-09-17', amount: 150, category: 'transport', description: 'Jeepney fare', note: 'Commute' }
    ]
  };
  localStorage.setItem('moms-budget-data', JSON.stringify(data));
};

server.listen(PORT, '127.0.0.1', async () => {
  console.log('Server: http://127.0.0.1:' + PORT);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();

  const logs = [];
  page.on('console', m => logs.push({ t: m.type(), txt: m.text() }));
  page.on('pageerror', e => logs.push({ t: 'pageerror', txt: e.message }));

  await page.addInitScript(injectScript);

  try {
    await page.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1500);
    await page.setViewportSize({ width: 360, height: 780 });
    await page.waitForTimeout(600);

    // Check for the bug
    const headerText = await page.evaluate(() => {
      const h1 = document.querySelector('.top-header h1');
      return h1 ? h1.innerText : 'NO H1';
    });
    console.log('Header text:', headerText);
    console.log('Has [object HTMLDivElement]:', headerText.includes('[object HTMLDivElement]'));

    const main = await page.$('#main-content');
    const sections = main ? await main.$$('section') : [];
    console.log('Sections:', sections.length);

    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('Has Meralco:', bodyText.includes('Meralco'));
    console.log('Has ₱ symbol:', bodyText.includes('₱'));
    console.log('Has 15th Drop:', bodyText.includes('15th Drop'));

    const s1 = path.join(dir, 'screenshot.png');
    await page.screenshot({ path: s1, fullPage: false });
    console.log('Saved:', s1);

    const s2 = path.join(dir, 'screenshot-full.png');
    await page.screenshot({ path: s2, fullPage: true });
    console.log('Saved:', s2);

    console.log('\n--- Console ---');
    logs.forEach(l => console.log('[' + l.t + '] ' + l.txt));
    const errs = logs.filter(l => l.t === 'error' || l.t === 'pageerror');
    console.log('Errors:', errs.length);
    if (errs.length > 0) errs.forEach(e => console.log('  ERROR:', e.txt));
  } catch (e) {
    console.error('FAIL:', e.message);
  } finally {
    await browser.close();
    server.close();
    console.log('Done.');
  }
});
