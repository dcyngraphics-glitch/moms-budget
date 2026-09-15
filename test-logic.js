const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://127.0.0.1:8080/index.html');
    await page.waitForLoadState('networkidle');
    console.log('Page loaded');
    
    // Test 1: Payday prefill behavior
    console.log('\n=== Test 1: Payday Prefill ===');
    
    // Check what date would be prefilled
    const today = new Date();
    const month = today.getMonth(); // 0-indexed
    const todayDate = today.getDate();
    
    console.log('Today:', today.toISOString());
    console.log('Day:', todayDate, '| Month:', month + 1);
    
    // The app.js logic: if today <= 15, default to 15th; else default to 30th/last day
    let expectedDefault;
    if (todayDate <= 15) {
      expectedDefault = `${today.getFullYear()}-${String(month + 1).padStart(2, '0')}-15`;
      console.log('Expected default: 15th of current month →', expectedDefault);
    } else {
      const lastDay = new Date(today.getFullYear(), month + 1, 0).getDate();
      const defaultDay = Math.min(30, lastDay);
      expectedDefault = `${today.getFullYear()}-${String(month + 1).padStart(2, '0')}-${defaultDay}`;
      console.log('Expected default: 30th (or last day) →', expectedDefault);
    }
    
    // Now trigger the add cash drop button and check what gets prefilled
    await page.click('#addDropBtn');
    await page.waitForTimeout(100);
    
    const actualDate = await page.locator('#dropDate').inputValue();
    console.log('Actual prefilled date:', actualDate || '(empty)');
    
    if (actualDate === expectedDefault) {
      console.log('✓ PASS: Date prefill correct');
    } else {
      console.log('✗ FAIL: Expected', expectedDefault, 'but got', actualDate);
    }
    
    // Check if amount is prefilled (should be empty based on user choice)
    const actualAmount = await page.locator('#dropAmount').inputValue();
    console.log('Amount prefilled:', actualAmount || '(empty - correct, no prefill)');
    
    // Close the cash drop form (just clear it, no modal for cash drops)
    await page.locator('#dropDate').fill('');
    await page.locator('#dropAmount').fill('');
    
    // Test 2: Full workflow with data
    console.log('\n=== Test 2: Full Workflow ===');
    
    // Add 15th payday
    await page.locator('#dropDate').fill('2026-09-15');
    await page.locator('#dropAmount').fill('15000');
    await page.click('#addDropBtn');
    console.log('✓ Added 15th payday: ₱15,000');
    await page.waitForTimeout(200);
    
    // Add 30th payday  
    await page.locator('#dropDate').fill('2026-09-30');
    await page.locator('#dropAmount').fill('15000');
    await page.click('#addDropBtn');
    console.log('✓ Added 30th payday: ₱15,000');
    await page.waitForTimeout(200);
    
    // Add bill
    await page.click('#addBillBtn');
    await page.waitForTimeout(100);
    await page.locator('#billName').fill('Meralco Electric');
    await page.locator('#billAmount').fill('2500');
    await page.locator('#billDueDate').fill('2026-09-20');
    await page.locator('#billCategory').selectOption('utilities');
    await page.click('#saveBill');
    console.log('✓ Added bill: Meralco ₱2,500 due 9/20');
    await page.waitForTimeout(200);
    
    // Add another bill
    await page.click('#addBillBtn');
    await page.waitForTimeout(100);
    await page.locator('#billName').fill('Water Billing');
    await page.locator('#billAmount').fill('800');
    await page.locator('#billDueDate').fill('2026-09-25');
    await page.locator('#billCategory').selectOption('utilities');
    await page.click('#saveBill');
    console.log('✓ Added bill: Water ₱800 due 9/25');
    await page.waitForTimeout(200);
    
    // Add expense
    await page.click('#addExpenseBtn');
    await page.waitForTimeout(100);
    await page.locator('#expName').fill('Grocery');
    await page.locator('#expAmount').fill('2200');
    await page.locator('#expDate').fill('2026-09-16');
    await page.locator('#expCategory').selectOption('food');
    await page.click('#saveExp');
    console.log('✓ Added expense: Grocery ₱2,200 on 9/16');
    await page.waitForTimeout(200);
    
    // Check the rendered lists
    console.log('\n=== Test 3: Verify Rendered Data ===');
    
    // Cash drops list
    const dropsText = await page.locator('#dropsList').textContent();
    console.log('Cash Drops:', dropsText.substring(0, 200));
    
    // Bills list
    const billsText = await page.locator('#billsList').textContent();
    console.log('Bills:', billsText.substring(0, 200));
    
    // Expenses list
    const expensesText = await page.locator('#expensesList').textContent();
    console.log('Expenses:', expensesText.substring(0, 200));
    
    // Summary
    const summaryText = await page.locator('#summaryContent').textContent();
    console.log('\nSummary:', summaryText.replace(/\n+/g, ' | '));
    
    // Test 4: Edit and delete
    console.log('\n=== Test 4: Edit & Delete ===');
    
    // Mark first bill as paid
    await page.locator('.mark-paid').first().click();
    console.log('✓ Marked first bill as paid');
    await page.waitForTimeout(200);
    
    // Check bills list updated
    const billsAfterPaid = await page.locator('#billsList').textContent();
    console.log('Bills after mark-paid:', billsAfterPaid.substring(0, 200));
    
    // Delete expense
    await page.locator('[data-type="expense"]').first().click(); // This is the edit button
    await page.waitForTimeout(100);
    // Actually need to find the delete button specifically
    const deleteBtns = await page.locator('.item-actions .delete').all();
    if (deleteBtns.length > 0) {
      await deleteBtns[0].click();
      console.log('✓ Deleted an item');
      await page.waitForTimeout(200);
    }
    
    // Take final screenshot
    await page.screenshot({ path: 'screenshot-with-data.png', fullPage: false });
    console.log('\n✓ Screenshot saved: screenshot-with-data.png');
    
    // Compute expected vs actual
    console.log('\n=== Verification ===');
    console.log('Expected: Income ₱30,000 | Bills ₱3,300 | Expenses ₱2,200 | Balance ₱24,500');
    console.log('(After marking one bill paid and deleting one expense, values change)');
    
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
