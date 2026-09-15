const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push({ type: msg.type(), text: msg.text() }));
  
  try {
    await page.goto('http://127.0.0.1:8091/index.html');
    await page.waitForLoadState('networkidle');
    console.log('✓ Page loaded');
    
    // Wait for any async console messages
    await page.waitForTimeout(300);
    
    console.log('\n=== Console Logs ===');
    consoleLogs.forEach(log => {
      console.log(log.type + ':', log.text);
    });
    
    console.log('\n=== Tab State After Load ===');
    const tabStates = await page.evaluate(() => {
      const tabs = document.querySelectorAll('.tab-item');
      return Array.from(tabs).map(t => ({
        tab: t.dataset.tab,
        classes: t.className,
        active: t.classList.contains('active')
      }));
    });
    console.log(JSON.stringify(tabStates, null, 2));
    
    const displays = await page.evaluate(() => {
      const sections = document.querySelectorAll('.cash-drop-section, .bills-section, .expenses-section');
      return Array.from(sections).map(el => ({
        cls: el.className.split(' ')[0],
        display: getComputedStyle(el).display
      }));
    });
    console.log('Section displays:', JSON.stringify(displays, null, 2));
    
    // Click bills tab
    console.log('\n=== Click Bills Tab ===');
    await page.locator('[data-tab="bills"]').click();
    await page.waitForTimeout(200);
    
    const displaysAfter = await page.evaluate(() => {
      const sections = document.querySelectorAll('.cash-drop-section, .bills-section, .expenses-section');
      return Array.from(sections).map(el => ({
        cls: el.className.split(' ')[0],
        display: getComputedStyle(el).display
      }));
    });
    console.log('After click:', JSON.stringify(displaysAfter, null, 2));
    
    const newTabStates = await page.evaluate(() => {
      const tabs = document.querySelectorAll('.tab-item');
      return Array.from(tabs).map(t => ({
        tab: t.dataset.tab,
        active: t.classList.contains('active')
      }));
    });
    console.log('New tab states:', JSON.stringify(newTabStates, null, 2));
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
