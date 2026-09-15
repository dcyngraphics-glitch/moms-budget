const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://127.0.0.1:8081/index.html');
    await page.waitForLoadState('networkidle');
    console.log('✓ Page loaded');
    
    // Test 1: Tab bar behavior
    console.log('\n=== Test 1: Tab Bar ===');
    
    // Initial state
    const summaryVis = await page.locator('.summary-section').isVisible();
    const incomeVis = await page.locator('.cash-drop-section').isVisible();
    const billsVis = await page.locator('.bills-section').isVisible();
    const expensesVis = await page.locator('.expenses-section').isVisible();
    console.log('Initial: summary=' + summaryVis + ', income=' + incomeVis + ', bills=' + billsVis + ', expenses=' + expensesVis);
    
    // Click bills tab
    await page.locator('[data-tab="bills"]').click();
    await page.waitForTimeout(150);
    const billsNow = await page.locator('.bills-section').isVisible();
    const incomeNow = await page.locator('.cash-drop-section').isVisible();
    const summaryNow = await page.locator('.summary-section').isVisible();
    console.log('After Bills tab: summary=' + summaryNow + ', income=' + incomeNow + ', bills=' + billsNow);
    
    if (!incomeNow && billsNow && summaryNow) {
      console.log('✓ Tab switching works correctly');
    } else {
      console.log('✗ Tab switching NOT working as expected');
    }
    
    // Test 2: Payday prefill
    console.log('\n=== Test 2: Payday Prefill ===');
    
    await page.locator('#addDropBtn').click();
    await page.waitForTimeout(100);
    
    const prefillDate = await page.locator('#dropDate').inputValue();
    const prefillAmount = await page.locator('#dropAmount').inputValue();
    const placeholder = await page.locator('#dropAmount').getAttribute('placeholder');
    console.log('Prefilled date:', prefillDate || '(empty)');
    console.log('Prefilled amount:', prefillAmount || '(empty)');
    console.log('Placeholder:', placeholder);
    
    const today = new Date();
    const todayDate = today.getDate();
    let expectedDate;
    if (todayDate <= 15) {
      expectedDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-15';
    } else {
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      expectedDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + Math.min(30, lastDay);
    }
    console.log('Expected date:', expectedDate);
    console.log('Date matches:', prefillDate === expectedDate ? '✓ YES' : '✗ NO');
    console.log('Amount prefill (first month):', prefillAmount === '' ? '✓ Empty (correct)' : '✗ Has value');
    
    // Cancel the form (clear fields, no modal to close)
    await page.locator('#dropDate').fill('');
    await page.locator('#dropAmount').fill('');
    
    // Test 3: Add sample data
    console.log('\n=== Test 3: Add Sample Data ===');
    
    // Add 15th payday
    await page.locator('#dropDate').fill('2026-09-15');
    await page.locator('#dropAmount').fill('15000');
    await page.locator('#addDropBtn').click();
    console.log('✓ Added 15th payday: ₱15,000');
    await page.waitForTimeout(150);
    
    // Add 30th payday  
    await page.locator('#dropDate').fill('2026-09-30');
    await page.locator('#dropAmount').fill('15000');
    await page.locator('#addDropBtn').click();
    console.log('✓ Added 30th payday: ₱15,000');
    await page.waitForTimeout(150);
    
    // Go to bills tab to add a bill
    await page.locator('[data-tab="bills"]').click();
    await page.waitForTimeout(150);
    console.log('✓ Switched to Bills tab');
    
    // Add bill
    await page.locator('#addBillBtn').click();
    await page.waitForTimeout(100);
    await page.locator('#billName').fill('Meralco Electric');
    await page.locator('#billAmount').fill('2500');
    await page.locator('#billDueDate').fill('2026-09-20');
    await page.locator('#billCategory').selectOption('utilities');
    await page.locator('#saveBill').click();
    console.log('✓ Added bill: Meralco ₱2,500 due 9/20');
    await page.waitForTimeout(150);
    
    // Add another bill
    await page.locator('#addBillBtn').click();
    await page.waitForTimeout(100);
    await page.locator('#billName').fill('Water Billing');
    await page.locator('#billAmount').fill('800');
    await page.locator('#billDueDate').fill('2026-09-25');
    await page.locator('#billCategory').selectOption('utilities');
    await page.locator('#saveBill').click();
    console.log('✓ Added bill: Water ₱800 due 9/25');
    await page.waitForTimeout(150);
    
    // Go to expenses tab
    await page.locator('[data-tab="expenses"]').click();
    await page.waitForTimeout(150);
    console.log('✓ Switched to Expenses tab');
    
    // Add expense
    await page.locator('#addExpenseBtn').click();
    await page.waitForTimeout(100);
    await page.locator('#expName').fill('Grocery');
    await page.locator('#expAmount').fill('2200');
    await page.locator('#expDate').fill('2026-09-16');
    await page.locator('#expCategory').selectOption('food');
    await page.locator('#saveExp').click();
    console.log('✓ Added expense: Grocery ₱2,200 on 9/16');
    await page.waitForTimeout(150);
    
    // Test 4: Edit bill
    console.log('\n=== Test 4: Edit Bill ===');
    
    // Click the ✎ edit button on first bill (not the delete X)
    await page.locator('.item-actions button[data-type="bill"]').first().click();
    await page.waitForTimeout(150);
    
    const editModalTitle = await page.locator('.modal-content h3').textContent();
    console.log('Edit modal title:', editModalTitle);
    
    if (editModalTitle.includes('Edit')) {
      console.log('✓ Edit modal opened correctly');
    } else {
      console.log('✗ Edit modal did not open');
    }
    
    // Change the bill name
    await page.locator('#billName').fill('Meralco (Updated)');
    await page.locator('#saveBill').click();
    console.log('✓ Updated bill name');
    await page.waitForTimeout(150);
    
    // Verify update
    await page.locator('[data-tab="bills"]').click();
    await page.waitForTimeout(150);
    const billsText = await page.locator('#billsList').textContent();
    console.log('Bill updated:', billsText.includes('Meralco (Updated)') ? '✓ YES' : '✗ NO');
    
    // Test 5: Mark bill as paid
    console.log('\n=== Test 5: Mark Bill Paid ===');
    
    await page.locator('.mark-paid').first().click();
    await page.waitForTimeout(150);
    console.log('✓ Marked first bill as paid');
    
    const billsAfterPaid = await page.locator('#billsList').textContent();
    console.log('Bill shows Paid:', billsAfterPaid.includes('Paid') ? '✓ YES' : '✗ NO');
    
    // Test 6: Delete expense
    console.log('\n=== Test 6: Delete Expense ===');
    
    await page.locator('[data-tab="expenses"]').click();
    await page.waitForTimeout(150);
    
    // Click the ✕ delete button on first expense
    await page.locator('.item-actions .delete').first().click();
    await page.waitForTimeout(150);
    console.log('✓ Clicked delete on expense');
    
    // Test 7: Summary verification
    console.log('\n=== Test 7: Summary Verification ===');
    
    await page.locator('[data-tab="summary"]').click();
    await page.waitForTimeout(150);
    
    const summaryText = await page.locator('#summaryContent').textContent();
    console.log('Summary output:');
    console.log(summaryText.replace(/\n+/g, ' | '));
    
    console.log('\n=== Expected values ===');
    console.log('Income: ₱30,000 (15th ₱15,000 + 30th ₱15,000)');
    console.log('Bills Due: ₱800 (Water ₱800, Meralco marked paid)');
    console.log('Expenses: ₱2,200 (Grocery, if not deleted)');
    console.log('Balance: ₱' + (30000 - 800 - 2200) + '');
    
    // Take final screenshot
    await page.screenshot({ path: 'screenshot-polished.png', fullPage: false });
    console.log('\n✓ Screenshot saved: screenshot-polished.png');
    
    console.log('\n=== ALL TESTS COMPLETE ===');
    
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
