const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const dir = 'C:/Users/bryan/Documents/Hermes/Projects/moms-budget';
const PORT = 8083;

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0].split('#')[0];
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(dir, urlPath);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

const injectData = function () {
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
  await page.addInitScript(injectData);

  try {
    await page.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1500);
    await page.setViewportSize({ width: 360, height: 780 });
    await page.waitForTimeout(500);

    console.log('=== Fix Verification ===\n');

    // 1. FAB position — get the last .item on the page and compare to FAB
    const fab = await page.$('.fab');
    const fabBox = await fab.boundingBox();

    const lastItem = await page.$('.item:last-of-type');
    const lastBox = await lastItem.boundingBox();

    console.log('1. FAB overlap check:');
    console.log('   FAB: y=' + fabBox.y.toFixed(1) + ' h=' + fabBox.height.toFixed(1) + ' → bottom=' + (fabBox.y + fabBox.height).toFixed(1));
    console.log('   Last item: y=' + lastBox.y.toFixed(1) + ' h=' + lastBox.height.toFixed(1) + ' → bottom=' + (lastBox.y + lastBox.height).toFixed(1));
    const fabBottom = fabBox.y + fabBox.height;
    const itemTop = lastBox.y;
    console.log('   Overlap:', fabBottom > itemTop ? 'YES' : 'NO (clear by ' + (itemTop - fabBottom).toFixed(1) + 'px)');

    // 2. Tag text
    console.log('\n2. Bill tag text verification:');
    const tags = await page.$$eval('.bill-tag', els => els.map(el => el.textContent.trim()));
    tags.forEach((t, i) => console.log('   Tag ' + (i+1) + ':', t, '(show)' + (t.length > 3 ? 'ing full' : ' truncated')));

    // 3. Pulse animation
    const hasPulse = await page.evaluate(() => {
      const fab = document.querySelector('.fab');
      if (!fab) return { hasStyle: false, animation: '' };
      const cs = window.getComputedStyle(fab);
      return { hasStyle: true, animation: cs.animationName, iter: cs.animationIterationCount };
    });
    console.log('\n3. FAB pulse:');
    console.log('   Animation:', hasPulse.animation || '(none)');
    console.log('   Iterations:', hasPulse.iter || '?');

    // 4. Snapshot
    await page.screenshot({ path: dir + '/screenshot.png', fullPage: false });
    console.log('\n4. Saved screenshot.png');
    console.log('\n=== DONE ===');

  } catch (e) {
    console.error('FAIL:', e.message);
  } finally {
    await browser.close();
    server.close();
  }
});
