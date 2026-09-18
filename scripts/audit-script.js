const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://127.0.0.1:8080/index.html');
    await page.waitForLoadState('networkidle');
    
    // Capture screenshot for vision analysis
    await page.screenshot({ path: 'screenshot-initial.png', fullPage: false });
    console.log('Screenshot saved');
    
    // Extract page content
    const title = await page.title();
    const h1 = await page.locator('h1').textContent();
    console.log('Title:', title);
    console.log('H1:', h1);
    
    // Get all section headings
    const sectionHeadings = await page.locator('section h2').allTextContents();
    console.log('Section headings:', sectionHeadings);
    
    // Check key elements
    const monthYear = await page.locator('#monthYear').textContent();
    console.log('Month display:', monthYear);
    
    const currentDate = await page.locator('#currentDate').textContent();
    console.log('Current date:', currentDate);
    
    // Check button presence
    const buttons = await page.locator('button').allTextContents();
    console.log('Buttons found:', buttons);
    
    // Check touch targets (button sizes)
    const btnData = await page.locator('.btn').evaluateAll(els => 
      els.map(el => ({
        text: el.textContent.trim(),
        width: el.offsetWidth,
        height: el.offsetHeight
      }))
    );
    console.log('Button touch targets:', JSON.stringify(btnData, null, 2));
    
    // Check section touch targets and spacing
    const sections = await page.locator('section').evaluateAll(els =>
      els.map(el => ({
        heading: el.querySelector('h2')?.textContent || 'no heading',
        padding: getComputedStyle(el).padding,
        marginBottom: getComputedStyle(el).marginBottom
      }))
    );
    console.log('Section layout:', JSON.stringify(sections, null, 2));
    
    // Check overall page dimensions
    const viewport = await page.viewportSize();
    console.log('Viewport size:', viewport);
    
    // Get computed styles for key elements
    const rootStyles = await page.locator('body').evaluate(el => ({
      fontFamily: getComputedStyle(el).fontFamily,
      fontSize: getComputedStyle(el).fontSize,
      color: getComputedStyle(el).color,
      backgroundColor: getComputedStyle(el).backgroundColor
    }));
    console.log('Body styles:', rootStyles);
    
    // Check color contrast for key text elements
    const headingContrast = await page.locator('section h2').evaluate(el => ({
      color: getComputedStyle(el).color,
      backgroundColor: getComputedStyle(el).backgroundColor
    }));
    console.log('Heading contrast base:', headingContrast);
    
    // Check if there's adequate spacing between interactive elements
    const spacing = await page.locator('.btn + .btn').evaluateAll(els =>
      els.map(el => ({
        marginLeft: getComputedStyle(el).marginLeft,
        marginTop: getComputedStyle(el).marginTop
      }))
    );
    console.log('Button spacing:', spacing);
    
    // Check modal
    const modalOverlay = await page.locator('#modalOverlay').isVisible();
    console.log('Modal visible:', modalOverlay);
    
    // Check max-width of app container
    const appWidth = await page.locator('#app').evaluate(el => ({
      maxWidth: getComputedStyle(el).maxWidth,
      margin: getComputedStyle(el).margin
    }));
    console.log('App container:', appWidth);
    
    console.log('\n=== AUDIT DATA COMPLETE ===');
    
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
