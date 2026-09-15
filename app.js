'use strict';

// ============================================================
// Ma'm Budget — Complete App Logic
// ============================================================

const STORAGE_KEY = 'moms-budget-data';
const BILL_CATEGORIES = ['utilities', 'rent', 'food', 'transport', 'health', 'other'];
const EXPENSE_CATEGORIES = ['food', 'transport', 'shopping', 'utilities', 'health', 'other'];

// ---------- Helpers ----------

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return '₱' + num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[m - 1] + ' ' + d + ', ' + y;
}

function getMonthName(monthIndex) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return months[monthIndex - 1] || '';
}

function getMonthYearLabel(year, month) {
  return getMonthName(month) + ' ' + year;
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function isSameMonth(dateStr, year, month) {
  if (!dateStr) return false;
  const [y, m] = dateStr.split('-').map(Number);
  return y === year && m === month;
}

function isSameDay(dateStr, year, month, day) {
  if (!dateStr) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  return y === year && m === month && d === day;
}

function parseDateInput(value) {
  // Accepts 'YYYY-MM-DD' or Date object
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return null;
}

function getComputedStyleSafe(el) {
  try { return getComputedStyle(el); } catch (e) { return null; }
}

// --- Form field error helpers ---
function showFieldError(input, message) {
  clearFieldError(input);
  const err = document.createElement('span');
  err.className = 'field-error';
  err.textContent = message;
  err.style.cssText = 'color:var(--danger);font-size:0.75rem;margin-top:2px;display:block;';
  input.parentNode.appendChild(err);
}

function clearFieldError(input) {
  const parent = input.parentNode;
  if (!parent) return;
  const existing = parent.querySelector('.field-error');
  if (existing) existing.remove();
  input.style.borderColor = '';
}

function clearFieldErrors(form) {
  form.querySelectorAll('.field-error').forEach(el => el.remove());
  form.querySelectorAll('input, select').forEach(el => el.style.borderColor = '');
}

// ---------- Storage ----------

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    // Ensure arrays exist
    data.cashDrops = Array.isArray(data.cashDrops) ? data.cashDrops : [];
    data.bills = Array.isArray(data.bills) ? data.bills : [];
    data.expenses = Array.isArray(data.expenses) ? data.expenses : [];
    return data;
  } catch (e) {
    console.warn('Failed to load budget data:', e);
    return null;
  }
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('Failed to save budget data:', e);
    alert('Could not save data. Storage may be full.');
    return false;
  }
}

// ---------- App State ----------

let appData = loadData() || { cashDrops: [], bills: [], expenses: [] };
let currentScreen = 'dashboard';
let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth() + 1; // 1-indexed

// ---------- DOM refs ----------

const mainContent = document.getElementById('main-content');
const modalOverlay = document.getElementById('modalOverlay');
const modalContent = document.getElementById('modalContent');

// ---------- Navigation ----------

function switchScreen(screen) {
  if (screen === currentScreen) return;
  currentScreen = screen;

  // Update nav buttons
  document.querySelectorAll('.nav-item').forEach(btn => {
    const isActive = btn.dataset.screen === screen;
    btn.classList.toggle('active', isActive);
    btn.classList.toggle('inactive', !isActive);
  });

  render();
}

function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      switchScreen(btn.dataset.screen);
    });
  });

  // FAB quick actions
  document.getElementById('fab').addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentScreen === 'income') openIncomeModal();
    else if (currentScreen === 'bills') openBillModal();
    else if (currentScreen === 'expenses') openExpenseModal();
    else {
      // Dashboard: show quick action sheet
      openQuickActions();
    }
  });
}

function openQuickActions() {
  const html = `
    <div class="modal-content">
      <h3>Quick Actions</h3>
      <div class="form-row">
        <button class="btn btn-primary" id="qa-income" style="width:100%;margin-bottom:8px;">💰 Add Income</button>
      </div>
      <div class="form-row">
        <button class="btn btn-secondary" id="qa-bill" style="width:100%;margin-bottom:8px;">📄 Add Bill</button>
      </div>
      <div class="form-row">
        <button class="btn btn-secondary" id="qa-expense" style="width:100%;margin-bottom:8px;">🛒 Add Expense</button>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-cancel" id="qa-cancel">Cancel</button>
      </div>
    </div>
  `;
  openModal(html);

  document.getElementById('qa-income').addEventListener('click', () => { closeModal(); openIncomeModal(); });
  document.getElementById('qa-bill').addEventListener('click', () => { closeModal(); openBillModal(); });
  document.getElementById('qa-expense').addEventListener('click', () => { closeModal(); openExpenseModal(); });
  document.getElementById('qa-cancel').addEventListener('click', closeModal);
}

// ---------- Month Navigation ----------

function buildMonthSelector(year, month) {
  const daysInMonth = getDaysInMonth(year, month);
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return `
    <div class="month-selector">
      <button class="nav-btn" data-action="prev-month" aria-label="Previous month">◀</button>
      <span class="month-year-label">${getMonthYearLabel(year, month)}</span>
      <button class="nav-btn" data-action="next-month" aria-label="Next month">▶</button>
    </div>`;
}

function showMonthPicker(anchor, year, month) {
  // Simple inline month/year picker
  const existing = document.getElementById('monthPickerPopup');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.id = 'monthPickerPopup';
  popup.style.cssText = `
    position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
    background: var(--bg-elevated); border-radius: var(--radius-md); padding: 16px;
    box-shadow: var(--shadow-modal); z-index: 500;
    min-width: 220px; border: 1px solid var(--border-subtle);
    color: var(--text-primary);
  `;

  // Year buttons
  const yearHtml = `
    <div style="display:flex;gap:4px;margin-bottom:8px;justify-content:center">
      <button class="btn btn-sm btn-secondary" style="width:auto;font-size:0.8rem;padding:6px 10px;background:var(--bg-elevated);border:1px solid var(--border-subtle);" data-action="year-prev">◀</button>
      <span style="flex:1;text-align:center;font-weight:600;font-size:0.95rem;color:var(--text-primary);" id="pickerYear">${year}</span>
      <button class="btn btn-sm btn-secondary" style="width:auto;font-size:0.8rem;padding:6px 10px;background:var(--bg-elevated);border:1px solid var(--border-subtle);" data-action="year-next">▶</button>
    </div>
  `;

  // Month list
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthHtml = months.map((m, i) =>
    `<button class="month-option" data-month="${i+1}" style="display:block;width:100%;text-align:left;padding:8px 12px;border:none;background:transparent;cursor:pointer;font-size:0.9rem;border-bottom:1px solid var(--border-subtle);color:var(--text-primary);">${m}</button>`
  ).join('');

  popup.innerHTML = yearHtml + `<div style="max-height:200px;overflow-y:auto">${monthHtml}</div>`;

  anchor.parentNode.insertBefore(popup, anchor.nextSibling);

  // Position below anchor
  const rect = anchor.getBoundingClientRect();
  popup.style.position = 'fixed';
  popup.style.top = (rect.bottom + 4) + 'px';
  popup.style.left = (rect.left) + 'px';
  popup.style.transform = 'none';

  popup.querySelector('[data-action="year-prev"]').addEventListener('click', () => {
    const ySpan = popup.querySelector('#pickerYear');
    ySpan.textContent = parseInt(ySpan.textContent) - 1;
    highlightMonth(popup, parseInt(ySpan.textContent), month);
  });

  popup.querySelector('[data-action="year-next"]').addEventListener('click', () => {
    const ySpan = popup.querySelector('#pickerYear');
    ySpan.textContent = parseInt(ySpan.textContent) + 1;
    highlightMonth(popup, parseInt(ySpan.textContent), month);
  });

  popup.querySelectorAll('.month-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const newMonth = parseInt(opt.dataset.month);
      const newYear = parseInt(popup.querySelector('#pickerYear').textContent);
      viewMonth = newMonth;
      viewYear = newYear;
      popup.remove();
      render();
    });
    if (parseInt(opt.dataset.month) === month) {
      opt.style.background = 'var(--teal-glow)';
      opt.style.fontWeight = '600';
      opt.style.color = 'var(--teal)';
    }
  });
}

function highlightMonth(popup, year, month) {
  popup.querySelectorAll('.month-option').forEach(opt => {
    const isSelected = parseInt(opt.dataset.month) === month;
    opt.style.background = isSelected ? 'var(--teal-glow)' : 'transparent';
    opt.style.fontWeight = isSelected ? '600' : 'normal';
    opt.style.color = isSelected ? 'var(--teal)' : 'var(--text-primary)';
  });
}

// ---------- Dashboard ----------

function renderDashboard() {
  const items = [];
  
  // Month header
  items.push(buildMonthSelector(viewYear, viewMonth));

  // Income this month
  const monthIncome = appData.cashDrops
    .filter(d => isSameMonth(d.date, viewYear, viewMonth))
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  // Unpaid bills this month
  const monthUnpaidBills = appData.bills
    .filter(b => isSameMonth(b.dueDate, viewYear, viewMonth) && !b.paid)
    .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  // Expenses this month
  const monthExpenses = appData.expenses
    .filter(e => isSameMonth(e.date, viewYear, viewMonth))
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const remaining = monthIncome - monthUnpaidBills - monthExpenses;

  // Summary cards — hero layout: Income full-width, then 3-column row
  const summaryHTML = `
    <section class="summary-section">
      <h2 class="section-title">Month Summary</h2>
      <div class="summary-hero">
        <div class="summary-card income hero">
          <div class="label">Total Income</div>
          <div class="value" data-tick-start="0" data-tick-end="${monthIncome}">${formatCurrency(monthIncome)}</div>
        </div>
        <div class="summary-row">
          <div class="summary-card bills">
            <div class="label">Bills Due</div>
            <div class="value" data-tick-start="0" data-tick-end="${monthUnpaidBills}">${formatCurrency(monthUnpaidBills)}</div>
          </div>
          <div class="summary-card expenses">
            <div class="label">Expenses</div>
            <div class="value" data-tick-start="0" data-tick-end="${monthExpenses}">${formatCurrency(monthExpenses)}</div>
          </div>
          <div class="summary-card ${remaining < 0 ? 'over' : 'balance'} remaining">
            <div class="label">Remaining</div>
            <div class="value" data-tick-start="0" data-tick-end="${remaining}">${formatCurrency(remaining)}</div>
          </div>
        </div>
      </div>
    </section>
  `;
  items.push(summaryHTML);

  // Payday cards
  const drop15 = appData.cashDrops.find(d => isSameDay(d.date, viewYear, viewMonth, 15));
  const drop30 = appData.cashDrops.find(d => isSameDay(d.date, viewYear, viewMonth, 30));

  const paydayHTML = `
    <section>
      <h2 class="section-title">Paydays</h2>
      <div class="summary-grid" style="grid-template-columns: 1fr 1fr;">
        <div class="summary-card income">
          <div class="label">15th Drop</div>
          <div class="value" style="font-size:1.1rem;">
            ${drop15 ? formatCurrency(drop15.amount) : 'No drop yet'}
          </div>
          ${drop15 ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">${drop15.note || ''}</div>` : ''}
        </div>
        <div class="summary-card balance">
          <div class="label">30th Drop</div>
          <div class="value" style="font-size:1.1rem;">
            ${drop30 ? formatCurrency(drop30.amount) : 'No drop yet'}
          </div>
          ${drop30 ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">${drop30.note || ''}</div>` : ''}
        </div>
      </div>
    </section>
  `;
  items.push(paydayHTML);

  // Unpaid bills (top 3)
  const unpaidBills = appData.bills
    .filter(b => isSameMonth(b.dueDate, viewYear, viewMonth) && !b.paid)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 3);

  let billsHTML = `
    <section>
      <h2 class="section-title">Unpaid Bills (${unpaidBills.length})</h2>
  `;

  if (unpaidBills.length === 0) {
    billsHTML += `<div class="list-empty">No unpaid bills this month. 🎉</div>`;
  } else {
    unpaidBills.forEach(b => {
      const isOverdue = b.dueDate < `${viewYear}-${String(viewMonth).padStart(2,'0')}-01`;
      billsHTML += `
        <div class="item" data-bill-id="${b.id}">
          <div class="item-info">
            <div class="item-name">
              <span class="name-text">${b.name}</span>
              <span class="bill-tag ${b.category || 'other'}">${b.category || 'other'}</span>
            </div>
            <div class="item-meta">
              Due: <span class="${isOverdue ? 'bill-due' : ''}">${formatDate(b.dueDate)}</span>
              ${b.note ? '· ' + b.note : ''}
            </div>
          </div>
          <div class="item-amount negative">${formatCurrency(b.amount)}</div>
          <div class="item-actions">
            <button class="btn-pay" data-id="${b.id}" title="Mark as paid">✓ Pay</button>
            <button class="delete" data-id="${b.id}" title="Delete">✕</button>
          </div>
        </div>
      `;
    });
  }
  billsHTML += `</section>`;
  items.push(billsHTML);

  // Recent expenses (last 5)
  const recentExpenses = appData.expenses
    .filter(e => isSameMonth(e.date, viewYear, viewMonth))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  let expensesHTML = `
    <section>
      <h2 class="section-title">Recent Expenses</h2>
  `;

  if (recentExpenses.length === 0) {
    expensesHTML += `<div class="list-empty">No expenses yet this month.</div>`;
  } else {
    recentExpenses.forEach(e => {
      expensesHTML += `
        <div class="item" data-expense-id="${e.id}">
          <div class="item-info">
            <div class="item-name"><span class="name-text">${e.description || 'Expense'}</span></div>
            <div class="item-meta">
              ${formatDate(e.date)}
              ${e.category ? '· ' + e.category : ''}
              ${e.note ? '· ' + e.note : ''}
            </div>
          </div>
          <div class="item-amount negative">${formatCurrency(e.amount)}</div>
          <div class="item-actions">
            <button class="edit" data-id="${e.id}" title="Edit">✎</button>
            <button class="delete" data-id="${e.id}" title="Delete">✕</button>
          </div>
        </div>
      `;
    });
  }
  expensesHTML += `</section>`;
  items.push(expensesHTML);

  mainContent.innerHTML = items.join('\n');

  // Attach event listeners
  attachDashboardListeners();
  
  // Start number tickers
  startNumberTickers();
}

function attachDashboardListeners() {
  // Month selector navigation (data-action buttons inside .month-selector)
  document.querySelectorAll('.month-selector .nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      if (action === 'prev-month') {
        viewMonth = viewMonth === 1 ? 12 : viewMonth - 1;
        viewYear = viewMonth === 12 ? viewYear - 1 : viewYear;
        render();
      } else if (action === 'next-month') {
        const daysInMonth = getDaysInMonth(viewYear, viewMonth);
        viewMonth = viewMonth === 12 ? 1 : viewMonth + 1;
        viewYear = viewMonth === 1 ? viewYear + 1 : viewYear;
        render();
      }
    });
  });

  // Month label click -> show picker
  const monthLabel = document.querySelector('.month-selector .month-year-label');
  if (monthLabel) {
    monthLabel.addEventListener('click', (e) => {
      e.stopPropagation();
      // Build a temporary anchor element to position the picker
      const tempAnchor = document.createElement('div');
      tempAnchor.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;';
      document.body.appendChild(tempAnchor);
      const rect = monthLabel.getBoundingClientRect();
      tempAnchor.style.left = rect.left + 'px';
      tempAnchor.style.top = rect.bottom + 'px';
      tempAnchor.style.width = rect.width + 'px';
      showMonthPicker(tempAnchor, viewYear, viewMonth);
      setTimeout(() => tempAnchor.remove(), 100);
    });
  }

  // Pay buttons
  document.querySelectorAll('.btn-pay').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      toggleBillPaid(id);
    });
  });

  // Delete buttons
  document.querySelectorAll('.item-actions .delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const parent = btn.closest('.item');
      const isBill = parent && parent.dataset.billId;
      if (isBill) deleteBill(id);
      else deleteExpense(id);
    });
  });

  // Edit buttons
  document.querySelectorAll('.item-actions .edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      openExpenseModal(id);
    });
  });
}

// ---------- Income Screen ----------

function renderIncome() {
  const items = [];

  items.push(buildMonthSelector(viewYear, viewMonth));

  const monthDrops = appData.cashDrops
    .filter(d => isSameMonth(d.date, viewYear, viewMonth))
    .sort((a, b) => b.date.localeCompare(a.date));

  let html = `<section><h2>Cash Drops</h2>`;

  if (monthDrops.length === 0) {
    html += `<div class="list-empty">No cash drops recorded this month. Tap + to add.</div>`;
  } else {
    monthDrops.forEach(d => {
      const dayNum = d.date.split('-')[2];
      const isPayday = dayNum === '15' || dayNum === '30';
      html += `
        <div class="item fade-in" data-drop-id="${d.id}">
          <div class="item-info">
            <div class="item-name">
              <span class="name-text">${isPayday ? '💰 Payday Drop' : '💵 Cash Drop'}</span>
              <span style="font-size:0.75rem;color:var(--text-muted);margin-left:6px;">${formatDate(d.date)}</span>
            </div>
            <div class="item-meta">${d.note || ''}</div>
          </div>
          <div class="item-amount positive">${formatCurrency(d.amount)}</div>
          <div class="item-actions">
            <button class="edit" data-id="${d.id}" title="Edit">✎</button>
            <button class="delete" data-id="${d.id}" title="Delete">✕</button>
          </div>
        </div>
      `;
    });
  }
  html += `</section>`;

  items.push(html);
  mainContent.innerHTML = items.join('\n');

  attachIncomeListeners();
}

function attachIncomeListeners() {
  document.querySelectorAll('.item-actions .delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteCashDrop(btn.dataset.id);
    });
  });

  document.querySelectorAll('.item-actions .edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openIncomeModal(btn.dataset.id);
    });
  });
}

// ---------- Bills Screen ----------

function renderBills() {
  const items = [];

  items.push(buildMonthSelector(viewYear, viewMonth));

  const monthBills = appData.bills
    .filter(b => isSameMonth(b.dueDate, viewYear, viewMonth))
    .sort((a, b) => {
      // Unpaid first, then by due date
      if (a.paid !== b.paid) return a.paid ? 1 : -1;
      return a.dueDate.localeCompare(b.dueDate);
    });

  let html = `<section><h2>Bills</h2>`;

  if (monthBills.length === 0) {
    html += `<div class="list-empty">No bills for this month. Tap + to add a bill.</div>`;
  } else {
    monthBills.forEach(b => {
      const isOverdue = !b.paid && b.dueDate < `${viewYear}-${String(viewMonth).padStart(2,'0')}-01`;
      html += `
        <div class="item fade-in" data-bill-id="${b.id}">
          <div class="item-info">
            <div class="item-name" style="${b.paid ? 'text-decoration:line-through;color:var(--text-muted);' : ''}">
              <span class="name-text">${b.name}</span>
              <span class="bill-tag ${b.category || 'other'}">${b.category || 'other'}</span>
            </div>
            <div class="item-meta">
              Due: <span class="${isOverdue && !b.paid ? 'bill-due' : ''}">${formatDate(b.dueDate)}</span>
              ${b.paid ? '· Paid ' + formatDate(b.paidDate) : ''}
              ${b.note ? '· ' + b.note : ''}
            </div>
          </div>
          <div class="item-amount ${b.paid ? '' : 'negative'}" style="${b.paid ? 'text-decoration:line-through;color:var(--text-muted);' : ''}">
            ${formatCurrency(b.amount)}
          </div>
          <div class="item-actions">
            <button class="${b.paid ? 'btn-unpay' : 'btn-pay'}" data-id="${b.id}" title="${b.paid ? 'Mark unpaid' : 'Mark as paid'}">
              ${b.paid ? '↩ Unpay' : '✓ Pay'}
            </button>
            <button class="delete" data-id="${b.id}" title="Delete">✕</button>
          </div>
        </div>
      `;
    });
  }
  html += `</section>`;

  items.push(html);
  mainContent.innerHTML = items.join('\n');

  attachBillsListeners();
}

function attachBillsListeners() {
  document.querySelectorAll('.btn-pay, .btn-unpay').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleBillPaid(btn.dataset.id, true);
    });
  });

  document.querySelectorAll('.item-actions .delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteBill(btn.dataset.id);
    });
  });
}

// ---------- Expenses Screen ----------

function renderExpenses() {
  const items = [];

  items.push(buildMonthSelector(viewYear, viewMonth));

  const monthExpenses = appData.expenses
    .filter(e => isSameMonth(e.date, viewYear, viewMonth))
    .sort((a, b) => b.date.localeCompare(a.date));

  let html = `<section><h2>Expenses</h2>`;

  if (monthExpenses.length === 0) {
    html += `<div class="list-empty">No expenses recorded this month. Tap + to add.</div>`;
  } else {
    monthExpenses.forEach(e => {
      const catLabel = e.category ? e.category.charAt(0).toUpperCase() + e.category.slice(1) : '';
      html += `
        <div class="item fade-in" data-expense-id="${e.id}">
          <div class="item-info">
            <div class="item-name"><span class="name-text">${e.description || 'Expense'}</span></div>
            <div class="item-meta">
              ${formatDate(e.date)}
              ${catLabel ? '· ' + catLabel : ''}
              ${e.note ? '· ' + e.note : ''}
            </div>
          </div>
          <div class="item-amount negative">${formatCurrency(e.amount)}</div>
          <div class="item-actions">
            <button class="edit" data-id="${e.id}" title="Edit">✎</button>
            <button class="delete" data-id="${e.id}" title="Delete">✕</button>
          </div>
        </div>
      `;
    });
  }
  html += `</section>`;

  items.push(html);
  mainContent.innerHTML = items.join('\n');

  attachExpensesListeners();
}

function attachExpensesListeners() {
  document.querySelectorAll('.item-actions .delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteExpense(btn.dataset.id);
    });
  });

  document.querySelectorAll('.item-actions .edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openExpenseModal(btn.dataset.id);
    });
  });
}

// ---------- Modal System ----------

let currentEscHandler = null;

function openModal(html) {
  modalContent.innerHTML = html;
  modalOverlay.classList.remove('hidden');
  // Animate in
  modalContent.classList.remove('slide-up');
  void modalContent.offsetWidth; // force reflow
  modalContent.classList.add('slide-up');

  // Attach cancel handler
  const cancelBtn = modalContent.querySelector('.btn-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeModal);
  }

  // Close on overlay click (but not if clicking modal itself)
  modalOverlay.onclick = (e) => {
    if (e.target === modalOverlay) closeModal();
  };

  // Close on Escape — remove previous handler before adding new one
  if (currentEscHandler) {
    document.removeEventListener('keydown', currentEscHandler);
  }
  currentEscHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', currentEscHandler);
      currentEscHandler = null;
    }
  };
  document.addEventListener('keydown', currentEscHandler);

  // Attach save handler via form submit (works for both type=submit buttons and Enter key)
  const form = modalContent.querySelector('form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const isIncome = form.id === 'incomeForm';
      const isBill = form.id === 'billForm';
      const isExpense = form.id === 'expenseForm';
      if (isIncome) handleIncomeSave();
      else if (isBill) handleBillSave();
      else if (isExpense) handleExpenseSave();
    });
  }
}

function closeModal() {
  modalOverlay.classList.add('hidden');
  modalContent.innerHTML = '';
  modalContent.classList.remove('slide-up');
}

// ---------- Income Modal ----------

function openIncomeModal(editId) {
  const isEdit = !!editId;
  const existing = isEdit ? appData.cashDrops.find(d => d.id === editId) : null;

  // Default date: closest of 15th or 30th to today
  const today = new Date();
  const todayDay = today.getDate();
  let defaultDay = 15;
  if (todayDay > 22) defaultDay = 30; // past 22nd, 30th is closer
  else if (todayDay > 15) {
    // between 16-22: compare distance
    const dist15 = Math.abs(todayDay - 15);
    const dist30 = Math.abs(todayDay - 30);
    defaultDay = dist15 <= dist30 ? 15 : 30;
  }

  const defaultDate = isEdit && existing
    ? existing.date
    : `${viewYear}-${String(viewMonth).padStart(2,'0')}-${String(defaultDay).padStart(2,'0')}`;

  const html = `
    <div class="modal-content">
      <h3>${isEdit ? 'Edit Cash Drop' : 'Add Cash Drop'}</h3>
      <form id="incomeForm" ${isEdit ? `data-edit-id="${editId}"` : ''}>
        <div class="form-row">
          <label for="incDate">Date</label>
          <input type="date" id="incDate" name="date" value="${defaultDate}" required>
        </div>
        <div class="form-row">
          <label for="incAmount">Amount (₱)</label>
          <input type="number" id="incAmount" name="amount" step="0.01" min="0.01" placeholder="e.g. 7500" value="${isEdit ? existing.amount : ''}" required>
        </div>
        <div class="form-row">
          <label for="incNote">Note (optional)</label>
          <input type="text" id="incNote" name="note" placeholder="e.g. From husband's salary" value="${isEdit ? (existing.note || '') : ''}" maxlength="100">
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary btn-save">${isEdit ? 'Update' : 'Save'}</button>
        </div>
      </form>
    </div>
  `;

  openModal(html);
}

function handleIncomeSave() {
  const form = document.getElementById('incomeForm');
  const dateInput = form.querySelector('#incDate');
  const amountInput = form.querySelector('#incAmount');
  const noteInput = form.querySelector('#incNote');

  // Clear previous errors
  [dateInput, amountInput, noteInput].forEach(i => i.style.borderColor = '');

  let valid = true;

  // Validate date
  const dateVal = dateInput.value;
  if (!dateVal || !/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
    dateInput.style.borderColor = 'var(--danger)';
    showFieldError(dateInput, 'Pick a date');
    valid = false;
  }

  // Validate amount
  const amountVal = parseFloat(amountInput.value);
  if (isNaN(amountVal) || amountVal <= 0) {
    amountInput.style.borderColor = 'var(--danger)';
    showFieldError(amountInput, 'Enter an amount');
    valid = false;
  }

  if (!valid) {
    // Shake the first invalid field
    const firstInvalid = document.querySelector('.form-row input[border-color="rgb(244, 67, 54)"]') ||
                          dateInput.style.borderColor === 'var(--danger)' ? dateInput : amountInput;
    firstInvalid.focus();
    return;
  }

  const entry = {
    id: generateId(),
    date: dateVal,
    amount: amountVal,
    note: noteInput.value.trim() || ''
  };

  // If editing, find and replace
  if (form.dataset.editId) {
    const idx = appData.cashDrops.findIndex(d => d.id === form.dataset.editId);
    if (idx >= 0) appData.cashDrops[idx] = entry;
  } else {
    appData.cashDrops.push(entry);
  }

  if (saveData(appData)) {
    closeModal();
    render();
  }
}

// ---------- Bill Modal ----------

function openBillModal(editId) {
  const isEdit = !!editId;
  const existing = isEdit ? appData.bills.find(b => b.id === editId) : null;

  // Default due date: next 15th or 30th
  const today = new Date();
  let defaultDue = '';
  if (isEdit && existing) {
    defaultDue = existing.dueDate;
  } else {
    const todayDay = today.getDate();
    let targetDay = 15;
    if (todayDay > 15) targetDay = 30;
    // If we're past both this month, use next month
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    if (targetDay > daysInMonth) targetDay = 15;
    const targetDateStr = `${viewYear}-${String(viewMonth).padStart(2,'0')}-${String(targetDay).padStart(2,'0')}`;
    if (targetDateStr < today.toISOString().slice(0,10)) {
      // Push to next month
      const nextM = viewMonth === 12 ? 1 : viewMonth + 1;
      const nextY = viewMonth === 12 ? viewYear + 1 : viewYear;
      defaultDue = `${nextY}-${String(nextM).padStart(2,'0')}-${String(targetDay).padStart(2,'0')}`;
    } else {
      defaultDue = targetDateStr;
    }
  }

  const categories = BILL_CATEGORIES.map(c =>
    `<option value="${c}" ${isEdit && existing && existing.category === c ? 'selected' : ''}>${c.charAt(0).toUpperCase() + c.slice(1)}</option>`
  ).join('');

  const html = `
    <div class="modal-content">
      <h3>${isEdit ? 'Edit Bill' : 'Add Bill'}</h3>
      <form id="billForm" ${isEdit ? `data-edit-id="${editId}"` : ''}>
        <div class="form-row">
          <label for="billName">Bill Name</label>
          <input type="text" id="billName" name="name" placeholder="e.g. Meralco Electric" value="${isEdit ? (existing.name || '') : ''}" required maxlength="50">
        </div>
        <div class="form-row">
          <label for="billAmount">Amount (₱)</label>
          <input type="number" id="billAmount" name="amount" step="0.01" min="0.01" placeholder="e.g. 2500" value="${isEdit ? existing.amount : ''}" required>
        </div>
        <div class="form-row">
          <label for="billDueDate">Due Date</label>
          <input type="date" id="billDueDate" name="dueDate" value="${defaultDue}" required>
        </div>
        <div class="form-row">
          <label for="billCategory">Category</label>
          <select id="billCategory" name="category">
            ${categories}
          </select>
        </div>
        <div class="form-row">
          <label for="billNote">Note (optional)</label>
          <input type="text" id="billNote" name="note" placeholder="e.g. Paid via GCash" value="${isEdit ? (existing.note || '') : ''}" maxlength="100">
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary btn-save">${isEdit ? 'Update' : 'Save'}</button>
        </div>
      </form>
    </div>
  `;

  openModal(html);
}

function handleBillSave() {
  const form = document.getElementById('billForm');
  const nameInput = form.querySelector('#billName');
  const amountInput = form.querySelector('#billAmount');
  const dueDateInput = form.querySelector('#billDueDate');
  const categoryInput = form.querySelector('#billCategory');
  const noteInput = form.querySelector('#billNote');

  clearFieldErrors(form);

  let valid = true;

  const nameVal = nameInput.value.trim();
  if (!nameVal) {
    nameInput.style.borderColor = 'var(--danger)';
    showFieldError(nameInput, 'Enter a name');
    valid = false;
  }

  const amountVal = parseFloat(amountInput.value);
  if (isNaN(amountVal) || amountVal <= 0) {
    amountInput.style.borderColor = 'var(--danger)';
    showFieldError(amountInput, 'Enter an amount');
    valid = false;
  }

  const dueDateVal = dueDateInput.value;
  if (!dueDateVal || !/^\d{4}-\d{2}-\d{2}$/.test(dueDateVal)) {
    dueDateInput.style.borderColor = 'var(--danger)';
    showFieldError(dueDateInput, 'Pick a due date');
    valid = false;
  }

  const categoryVal = categoryInput.value;
  if (!BILL_CATEGORIES.includes(categoryVal)) {
    categoryInput.style.borderColor = 'var(--danger)';
    valid = false;
  }

  if (!valid) {
    const firstInvalid = document.querySelector('.form-row input[border-color="rgb(244, 67, 54)"], .form-row select[border-color="rgb(244, 67, 54)"]');
    if (firstInvalid) firstInvalid.focus();
    return;
  }

  const entry = {
    id: generateId(),
    name: nameVal,
    amount: amountVal,
    dueDate: dueDateVal,
    category: categoryVal,
    paid: form.dataset.editId ? (appData.bills.find(b => b.id === form.dataset.editId)?.paid || false) : false,
    paidDate: form.dataset.editId ? (appData.bills.find(b => b.id === form.dataset.editId)?.paidDate || null) : null,
    note: noteInput.value.trim() || ''
  };

  if (form.dataset.editId) {
    const idx = appData.bills.findIndex(b => b.id === form.dataset.editId);
    if (idx >= 0) appData.bills[idx] = entry;
  } else {
    appData.bills.push(entry);
  }

  if (saveData(appData)) {
    closeModal();
    render();
  }
}

// ---------- Expense Modal ----------

function openExpenseModal(editId) {
  const isEdit = !!editId;
  const existing = isEdit ? appData.expenses.find(e => e.id === editId) : null;

  // Default date: today
  const today = new Date();
  const defaultDate = isEdit && existing
    ? existing.date
    : today.toISOString().slice(0, 10);

  const categories = EXPENSE_CATEGORIES.map(c =>
    `<option value="${c}" ${isEdit && existing && existing.category === c ? 'selected' : ''}>${c.charAt(0).toUpperCase() + c.slice(1)}</option>`
  ).join('');

  const html = `
    <div class="modal-content">
      <h3>${isEdit ? 'Edit Expense' : 'Add Expense'}</h3>
      <form id="expenseForm" ${isEdit ? `data-edit-id="${editId}"` : ''}>
        <div class="form-row">
          <label for="expDate">Date</label>
          <input type="date" id="expDate" name="date" value="${defaultDate}" required>
        </div>
        <div class="form-row">
          <label for="expAmount">Amount (₱)</label>
          <input type="number" id="expAmount" name="amount" step="0.01" min="0.01" placeholder="e.g. 150" value="${isEdit ? existing.amount : ''}" required>
        </div>
        <div class="form-row">
          <label for="expCategory">Category</label>
          <select id="expCategory" name="category">
            ${categories}
          </select>
        </div>
        <div class="form-row">
          <label for="expDescription">Description</label>
          <input type="text" id="expDescription" name="description" placeholder="e.g. Grocery at SM" value="${isEdit ? (existing.description || '') : ''}" required maxlength="100">
        </div>
        <div class="form-row">
          <label for="expNote">Note (optional)</label>
          <input type="text" id="expNote" name="note" placeholder="e.g. For the week" value="${isEdit ? (existing.note || '') : ''}" maxlength="100">
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary btn-save">${isEdit ? 'Update' : 'Save'}</button>
        </div>
      </form>
    </div>
  `;

  openModal(html);
}

function handleExpenseSave() {
  const form = document.getElementById('expenseForm');
  const dateInput = form.querySelector('#expDate');
  const amountInput = form.querySelector('#expAmount');
  const categoryInput = form.querySelector('#expCategory');
  const descInput = form.querySelector('#expDescription');
  const noteInput = form.querySelector('#expNote');

  clearFieldErrors(form);

  let valid = true;

  const dateVal = dateInput.value;
  if (!dateVal || !/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
    dateInput.style.borderColor = 'var(--danger)';
    showFieldError(dateInput, 'Pick a date');
    valid = false;
  }

  const amountVal = parseFloat(amountInput.value);
  if (isNaN(amountVal) || amountVal <= 0) {
    amountInput.style.borderColor = 'var(--danger)';
    showFieldError(amountInput, 'Enter an amount');
    valid = false;
  }

  const categoryVal = categoryInput.value;
  if (!EXPENSE_CATEGORIES.includes(categoryVal)) {
    categoryInput.style.borderColor = 'var(--danger)';
    showFieldError(categoryInput, 'Pick a category');
    valid = false;
  }

  const descVal = descInput.value.trim();
  if (!descVal) {
    descInput.style.borderColor = 'var(--danger)';
    showFieldError(descInput, 'Enter a description');
    valid = false;
  }

  if (!valid) {
    const firstInvalid = document.querySelector('.form-row input[border-color="rgb(244, 67, 54)"], .form-row select[border-color="rgb(244, 67, 54)"]');
    if (firstInvalid) firstInvalid.focus();
    return;
  }

  const entry = {
    id: generateId(),
    date: dateVal,
    amount: amountVal,
    category: categoryVal,
    description: descVal,
    note: noteInput.value.trim() || ''
  };

  if (form.dataset.editId) {
    const idx = appData.expenses.findIndex(e => e.id === form.dataset.editId);
    if (idx >= 0) appData.expenses[idx] = entry;
  } else {
    appData.expenses.push(entry);
  }

  if (saveData(appData)) {
    closeModal();
    render();
  }
}

// ---------- CRUD Actions ----------

function toggleBillPaid(id, animate = false) {
  const bill = appData.bills.find(b => b.id === id);
  if (!bill) return;

  const nowPaid = !bill.paid;
  bill.paid = nowPaid;
  bill.paidDate = nowPaid ? new Date().toISOString().slice(0, 10) : null;

  if (saveData(appData)) {
    if (animate) {
      // Animate the bill row
      const row = document.querySelector(`.item[data-bill-id="${id}"]`);
      if (row) {
        row.style.transition = 'all 0.3s ease';
        if (nowPaid) {
          row.style.opacity = '0.7';
          row.style.transform = 'scale(0.98)';
          setTimeout(() => {
            row.style.opacity = '1';
            row.style.transform = 'scale(1)';
          }, 150);
        }
      }
    }
    render();
  }
}

function deleteCashDrop(id) {
  if (!confirm('Delete this cash drop?')) return;
  appData.cashDrops = appData.cashDrops.filter(d => d.id !== id);
  if (saveData(appData)) render();
}

function deleteBill(id) {
  if (!confirm('Delete this bill?')) return;
  appData.bills = appData.bills.filter(b => b.id !== id);
  if (saveData(appData)) render();
}

function deleteExpense(id) {
  if (!confirm('Delete this expense?')) return;
  appData.expenses = appData.expenses.filter(e => e.id !== id);
  if (saveData(appData)) render();
}

// ---------- Motion & Delight ----------

function startNumberTickers() {
  const tickers = document.querySelectorAll('[data-tick-end]');
  tickers.forEach(ticker => {
    const start = parseFloat(ticker.dataset.tickStart) || 0;
    const end = parseFloat(ticker.dataset.tickEnd) || 0;
    const duration = 800;
    const startTime = performance.now();

    function update(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentVal = start + (end - start) * easeProgress;
      
      ticker.textContent = formatCurrency(currentVal);
      
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        ticker.textContent = formatCurrency(end);
      }
    }
    requestAnimationFrame(update);
  });
}

function addEntranceAnimations() {
  // Not strictly needed if CSS handles it, but allows JS-driven sequence
  const sections = document.querySelectorAll('section');
  sections.forEach((sec, i) => {
    sec.style.animationDelay = `${i * 100}ms`;
  });
}


// ---------- Notifications Screen ----------

function renderNotifications() {
  const items = [];
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  // Use viewYear/viewMonth for filtering
  const overdueBills = appData.bills.filter(b => !b.paid && b.dueDate < todayStr && isSameMonth(b.dueDate, viewYear, viewMonth));
  const dueToday = appData.bills.filter(b => !b.paid && b.dueDate === todayStr);
  const dueTomorrow = appData.bills.filter(b => !b.paid && b.dueDate === tomorrowStr);

  items.push(buildMonthSelector(viewYear, viewMonth));

  let html = `<section><h2>Notifications</h2>`;

  if (overdueBills.length === 0 && dueToday.length === 0 && dueTomorrow.length === 0) {
    html += `<div class="list-empty">No upcoming bills. 🎉</div>`;
  } else {
    if (overdueBills.length > 0) {
      html += `<h3 class="section-title" style="color:var(--danger);margin-top:12px;">⚠️ Overdue (${overdueBills.length})</h3>`;
      overdueBills.forEach(b => {
        html += `<div class="item fade-in" data-bill-id="${b.id}">
          <div class="item-info">
            <div class="item-name"><span class="name-text">${b.name}</span></div>
            <div class="item-meta">Due: ${formatDate(b.dueDate)}</div>
          </div>
          <div class="item-amount negative">${formatCurrency(b.amount)}</div>
          <div class="item-actions">
            <button class="btn-pay" data-id="${b.id}" title="Mark as paid">✓ Pay</button>
          </div>
        </div>`;
      });
    }

    if (dueToday.length > 0) {
      html += `<h3 class="section-title" style="color:var(--warning,#f59e0b);margin-top:12px;">📅 Due Today (${dueToday.length})</h3>`;
      dueToday.forEach(b => {
        html += `<div class="item fade-in" data-bill-id="${b.id}">
          <div class="item-info">
            <div class="item-name"><span class="name-text">${b.name}</span></div>
            <div class="item-meta">Due: ${formatDate(b.dueDate)}</div>
          </div>
          <div class="item-amount negative">${formatCurrency(b.amount)}</div>
          <div class="item-actions">
            <button class="btn-pay" data-id="${b.id}" title="Mark as paid">✓ Pay</button>
          </div>
        </div>`;
      });
    }

    if (dueTomorrow.length > 0) {
      html += `<h3 class="section-title" style="color:var(--text-muted);margin-top:12px;">📆 Due Tomorrow (${dueTomorrow.length})</h3>`;
      dueTomorrow.forEach(b => {
        html += `<div class="item fade-in" data-bill-id="${b.id}">
          <div class="item-info">
            <div class="item-name"><span class="name-text">${b.name}</span></div>
            <div class="item-meta">Due: ${formatDate(b.dueDate)}</div>
          </div>
          <div class="item-amount negative">${formatCurrency(b.amount)}</div>
          <div class="item-actions">
            <button class="btn-pay" data-id="${b.id}" title="Mark as paid">✓ Pay</button>
          </div>
        </div>`;
      });
    }
  }

  html += `</section>`;
  items.push(html);
  mainContent.innerHTML = items.join('\n');

  // Attach month selector listeners
  document.querySelectorAll('.month-selector .nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      if (action === 'prev-month') {
        viewMonth = viewMonth === 1 ? 12 : viewMonth - 1;
        viewYear = viewMonth === 12 ? viewYear - 1 : viewYear;
        render();
      } else if (action === 'next-month') {
        const daysInMonth = getDaysInMonth(viewYear, viewMonth);
        viewMonth = viewMonth === 12 ? 1 : viewMonth + 1;
        viewYear = viewMonth === 1 ? viewYear + 1 : viewYear;
        render();
      }
    });
  });

  // Attach pay handlers
  document.querySelectorAll('.btn-pay').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleBillPaid(btn.dataset.id, true);
    });
  });
}

// ---------- Statistics Screen ----------

function renderStatistics() {
  const items = [];
  const today = new Date();
  const currentYear = viewYear;
  const currentMonth = viewMonth;

  items.push(buildMonthSelector(viewYear, viewMonth));

  // Filter data for current month
  const monthIncome = appData.cashDrops
    .filter(d => isSameMonth(d.date, currentYear, currentMonth))
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  const monthBills = appData.bills
    .filter(b => isSameMonth(b.dueDate, currentYear, currentMonth));

  const monthExpenses = appData.expenses
    .filter(e => isSameMonth(e.date, currentYear, currentMonth));

  const totalBills = monthBills.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  const totalExpenses = monthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const remaining = monthIncome - totalBills - totalExpenses;

  // Category breakdown for expenses
  const expenseCategories = {};
  monthExpenses.forEach(e => {
    const cat = e.category || 'other';
    expenseCategories[cat] = (expenseCategories[cat] || 0) + (Number(e.amount) || 0);
  });

  // Category breakdown for bills
  const billCategories = {};
  monthBills.forEach(b => {
    const cat = b.category || 'other';
    billCategories[cat] = (billCategories[cat] || 0) + (Number(b.amount) || 0);
  });

  let html = `<section><h2>Statistics</h2>`;

  // Summary cards
  html += `<div class="summary-grid" style="margin-bottom:16px;">
    <div class="summary-card income">
      <div class="label">Total Income</div>
      <div class="value">${formatCurrency(monthIncome)}</div>
    </div>
    <div class="summary-card bills">
      <div class="label">Total Bills</div>
      <div class="value">${formatCurrency(totalBills)}</div>
    </div>
    <div class="summary-card expenses">
      <div class="label">Total Expenses</div>
      <div class="value">${formatCurrency(totalExpenses)}</div>
    </div>
    <div class="summary-card ${remaining < 0 ? 'over' : 'balance'}">
      <div class="label">Remaining</div>
      <div class="value" style="color: ${remaining < 0 ? 'var(--danger)' : ''}">${formatCurrency(remaining)}</div>
    </div>
  </div>`;

  // Expense category breakdown
  html += `<h3 class="section-title">Expenses by Category</h3>`;
  const expenseCatLabels = { food: 'Food', transport: 'Transport', shopping: 'Shopping', utilities: 'Utilities', health: 'Health', other: 'Other' };
  const expenseCatColors = { food: '#10b981', transport: '#3b82f6', shopping: '#8b5cf6', utilities: '#f59e0b', health: '#ef4444', other: '#6b7280' };

  if (Object.keys(expenseCategories).length === 0) {
    html += `<div class="list-empty">No expenses this month.</div>`;
  } else {
    html += `<div class="card" style="padding:16px;">`;
    Object.entries(expenseCategories).sort((a, b) => b[1] - a[1]).forEach(([cat, amount]) => {
      const pct = totalExpenses > 0 ? (amount / totalExpenses * 100).toFixed(1) : 0;
      html += `<div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:0.9rem;">${expenseCatLabels[cat] || cat}</span>
          <span style="font-size:0.9rem;font-weight:600;">${formatCurrency(amount)} (${pct}%)</span>
        </div>
        <div style="background:var(--bg-elevated);border-radius:8px;height:8px;overflow:hidden;">
          <div style="background:${expenseCatColors[cat] || '#6b7280'};height:100%;width:${pct}%;border-radius:8px;transition:width 0.5s ease;"></div>
        </div>
      </div>`;
    });
    html += `</div>`;
  }

  // Bill category breakdown
  html += `<h3 class="section-title" style="margin-top:16px;">Bills by Category</h3>`;
  const billCatLabels = { utilities: 'Utilities', rent: 'Rent', food: 'Food', transport: 'Transport', health: 'Health', other: 'Other' };
  const billCatColors = { utilities: '#f59e0b', rent: '#8b5cf6', food: '#10b981', transport: '#3b82f6', health: '#ef4444', other: '#6b7280' };

  if (Object.keys(billCategories).length === 0) {
    html += `<div class="list-empty">No bills this month.</div>`;
  } else {
    html += `<div class="card" style="padding:16px;">`;
    Object.entries(billCategories).sort((a, b) => b[1] - a[1]).forEach(([cat, amount]) => {
      const pct = totalBills > 0 ? (amount / totalBills * 100).toFixed(1) : 0;
      html += `<div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:0.9rem;">${billCatLabels[cat] || cat}</span>
          <span style="font-size:0.9rem;font-weight:600;">${formatCurrency(amount)} (${pct}%)</span>
        </div>
        <div style="background:var(--bg-elevated);border-radius:8px;height:8px;overflow:hidden;">
          <div style="background:${billCatColors[cat] || '#6b7280'};height:100%;width:${pct}%;border-radius:8px;transition:width 0.5s ease;"></div>
        </div>
      </div>`;
    });
    html += `</div>`;
  }

  // Monthly trend (last 6 months)
  html += `<h3 class="section-title" style="margin-top:16px;">6-Month Trend</h3>`;
  html += `<div class="card" style="padding:16px;">`;
  for (let i = 5; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - 1 - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const monthName = getMonthName(m).slice(0, 3);

    const income = appData.cashDrops
      .filter(drop => isSameMonth(drop.date, y, m))
      .reduce((sum, drop) => sum + (Number(drop.amount) || 0), 0);
    const bills = appData.bills
      .filter(b => isSameMonth(b.dueDate, y, m))
      .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
    const expenses = appData.expenses
      .filter(e => isSameMonth(e.date, y, m))
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-subtle);">
      <span style="font-weight:600;min-width:60px;">${monthName} ${y}</span>
      <div style="flex:1;display:flex;gap:8px;justify-content:flex-end;font-size:0.85rem;">
        <span style="color:var(--color-correct,#10b981);">+${formatCurrency(income)}</span>
        <span style="color:var(--danger);">-${formatCurrency(bills)}</span>
        <span style="color:var(--warning,#f59e0b);">-${formatCurrency(expenses)}</span>
      </div>
    </div>`;
  }
  html += `</div>`;

  html += `</section>`;
  items.push(html);
  mainContent.innerHTML = items.join('\n');

  // Attach month selector listeners
  document.querySelectorAll('.month-selector .nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      if (action === 'prev-month') {
        viewMonth = viewMonth === 1 ? 12 : viewMonth - 1;
        viewYear = viewMonth === 12 ? viewYear - 1 : viewYear;
        render();
      } else if (action === 'next-month') {
        const daysInMonth = getDaysInMonth(viewYear, viewMonth);
        viewMonth = viewMonth === 12 ? 1 : viewMonth + 1;
        viewYear = viewMonth === 1 ? viewYear + 1 : viewYear;
        render();
      }
    });
  });
}

// ---------- Main Render ----------

function render() {
  switch (currentScreen) {
    case 'dashboard': renderDashboard(); break;
    case 'income': renderIncome(); break;
    case 'bills': renderBills(); break;
    case 'expenses': renderExpenses(); break;
    case 'notifications': renderNotifications(); break;
    case 'statistics': renderStatistics(); break;
    default: renderDashboard();
  }
}

// ---------- Init ----------

function init() {
  initNavigation();
  render();

  // If viewYear/viewMonth is in the future (near end of month), keep current
  // Already initialized to current month above
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
