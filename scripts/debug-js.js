const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const allLogs = [];
  page.on('console', msg => allLogs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => allLogs.push({ type: 'PAGE_ERROR', text: err.message }));
  
  try {
    await page.goto('http://127.0.0.1:8091/index.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    console.log('=== All logs ===');
    allLogs.forEach(l => console.log(l.type + ':', l.text));
    
    // Check if app.js is loaded
    const appJsLoaded = await page.evaluate(() => {
      return typeof renderAll !== 'undefined' && typeof initTabs !== 'undefined';
    });
    console.log('\nFunctions defined (renderAll/initTabs):', appJsLoaded);
    
    // Check if initTabs was called by looking for side effects
    const tabBar = await page.locator('#tabBar');
    const tabBarExists = await tabBar.isVisible();
    console.log('Tab bar exists:', tabBarExists);
    
    // Try calling initTabs manually
    if (typeof initTabs === 'function') {
      console.log('\nManually calling initTabs()...');
      await page.evaluate(() => initTabs());
      await page.waitForTimeout(200);
      
      const displays = await page.evaluate(() => {
        return {
          income: getComputedStyle(document.querySelector('.cash-drop-section')).display,
          bills: getComputedStyle(document.querySelector('.bills-section')).display,
          expenses: getComputedStyle(document.querySelector('.expenses-section')).display
        };
      });
      console.log('Displays after manual initTabs:', displays);
    } else {
      console.log('initTabs function not available');
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
