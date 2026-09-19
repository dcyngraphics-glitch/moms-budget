// ============================================================
// Ma'm Budget — Premium Animated PWA Logic
// ============================================================

// ===== Database =====
const DB_KEY = 'moms-budget-premium-data-v1';

function loadData() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    return raw ? JSON.parse(raw) : { cashDrops: [], bills: [], expenses: [] };
  } catch {
    return { cashDrops: [], bills: [], expenses: [] };
  }
}

function saveData(data) {
  localStorage.setItem(DB_KEY, JSON.stringify(data));
}

// ===== State =====
let data = loadData();
let currentViewDate = new Date();
let editingBillId = null;
let editingExpenseId = null;

// ===== Formatting =====
function formatPesos(amount) {
  return '₱' + Math.abs(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getMonthYear(date) {
  return date.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
}

function getPaydayLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDate();
  if (day === 15) return '15th Payday';
  if (day === 30 || day === 31) return '30th Payday';
  return 'Other Income';
}

function getDueStatus(bill) {
  if (!bill.dueDate || bill.paid) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(bill.dueDate + 'T00:00:00');
  const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff <= 7) return 'soon';
  return '';
}

// ===== Render Functions =====
function renderDate() {
  document.getElementById('currentDate').textContent =
    new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' });
  document.getElementById('monthYear').textContent = getMonthYear(currentViewDate);
}

function renderDrops() {
  const container = document.getElementById('dropsList');
  const totalEl = document.getElementById('dropsTotal');
  const monthDrops = data.cashDrops.filter(d => {
    const dDate = new Date(d.date + 'T00:00:00');
    return dDate.getMonth() === currentViewDate.getMonth() &&
           dDate.getFullYear() === currentViewDate.getFullYear();
  });

  if (monthDrops.length === 0) {
    container.className = 'list-empty';
    container.innerHTML = `
      <span class="empty-icon">🪴</span>
      <div>No cash drops this month.<br>Add your first payday above.</div>`;
    totalEl.textContent = '₱0.00';
    return;
  }

  container.className = '';
  const monthIncome = monthDrops.reduce((sum, d) => sum + d.amount, 0);
  totalEl.textContent = formatPesos(monthIncome);

  let html = '';
  monthDrops.sort((a, b) => a.date < b.date ? -1 : 1).forEach(d => {
    html += `
    <div class="drop-item">
      <div class="drop-item-info">
        <div class="drop-item-title">
          ${getPaydayLabel(d.date)}
          <span class="payday-badge">${d.date.slice(5)}</span>
        </div>
        <div class="drop-item-subtitle">${formatDate(d.date)}</div>
      </div>
      <div class="drop-item-amount">${formatPesos(d.amount)}</div>
      <div class="drop-item-actions">
        <button class="drop-action-btn delete" data-id="${d.id}" title="Delete">✕</button>
      </div>
    </div>`;
  });

  container.innerHTML = html;
  container.querySelectorAll('[data-id]').forEach(btn => {
    btn.addEventListener('click', () => deleteItem('cashDrops', btn.dataset.id));
  });
}

function renderBills() {
  const container = document.getElementById('billsList');
  const summaryBar = document.getElementById('billsSummaryBar');
  const summaryTotal = document.getElementById('billsDueTotal');
  const monthBills = data.bills.filter(b => {
    if (!b.dueDate) return false;
    const bDate = new Date(b.dueDate + 'T00:00:00');
    return bDate.getMonth() === currentViewDate.getMonth() &&
           bDate.getFullYear() === currentViewDate.getFullYear();
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = data.bills.filter(b =>
    b.dueDate && !b.paid && new Date(b.dueDate + 'T00:00:00') < today
  );

  const all = [...overdue, ...monthBills];
  const dueTotal = all.filter(b => !b.paid).reduce((s, b) => s + b.amount, 0);

  if (all.length === 0) {
    container.className = 'list-empty';
    container.innerHTML = `
      <span class="empty-icon">📝</span>
      <div>No bills this month.</div>`;
    summaryBar.style.display = 'none';
    return;
  }

  container.className = '';
  if (dueTotal > 0) {
    summaryBar.style.display = 'flex';
    summaryTotal.textContent = formatPesos(dueTotal);
    summaryTotal.className = 'value';
  } else {
    summaryBar.style.display = 'flex';
    summaryTotal.textContent = 'All paid ✓';
    summaryTotal.className = 'value';
  }

  let html = '';
  all.forEach((b, idx) => {
    const dueStatus = getDueStatus(b);
    const dueLabel = dueStatus === 'overdue' ? '⚠️ Overdue' :
                     dueStatus === 'today' ? '🔴 Due Today' :
                     dueStatus === 'soon' ? `🟡 Due in ${Math.ceil((new Date(b.dueDate+'T00:00:00') - today)/(1000*60*60*24))}d` : '';
    const dueClass = dueStatus === 'overdue' ? 'overdue' : dueStatus === 'soon' ? 'due-soon' : '';

    html += `
    <div class="bill-item" style="animation-delay: ${idx * 0.05}s">
      <div class="bill-item-icon ${b.category}">${getCategoryEmoji(b.category)}</div>
      <div class="bill-item-info">
        <div class="bill-item-name">
          ${b.name}
          <span class="bill-category-tag ${b.category}">${b.category}</span>
        </div>
        <div class="bill-item-due ${dueClass}">${formatDate(b.dueDate)} — ${dueLabel}</div>
      </div>
      <div class="bill-item-amount ${b.paid ? 'paid' : ''}">
        ${b.paid ? formatPesos(b.amount) : formatPesos(b.amount)}
        ${b.paid ? '<span class="bill-item-status paid">Paid ✓</span>' : '<span class="bill-item-status unpaid">Unpaid</span>'}
      </div>
      <div class="bill-item-actions">
        <button class="toggle-paid-btn ${b.paid ? 'paid' : ''}" data-id="${b.id}" title="${b.paid ? 'Unmark paid' : 'Mark as paid'}">
          ${b.paid ? '↩' : '✓'}
        </button>
        <button class="edit-btn" data-id="${b.id}" title="Edit">✎</button>
        <button class="delete-btn" data-id="${b.id}" title="Delete">✕</button>
      </div>
    </div>`;
  });

  container.innerHTML = html;
  container.querySelectorAll('.toggle-paid-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleBillPaid(btn.dataset.id));
  });
  container.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => editBill(btn.dataset.id));
  });
  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteItem('bills', btn.dataset.id));
  });
}

function getCategoryEmoji(category) {
  const map = { utilities: '⚡', housing: '🏠', food: '🍲', transport: '🚗', health: '💊', other: '📌' };
  return map[category] || '📌';
}

function renderExpenses() {
  const container = document.getElementById('expensesList');
  const summaryBar = document.getElementById('expensesSummaryBar');
  const summaryTotal = document.getElementById('expensesTotal');
  const monthExp = data.expenses.filter(e => {
    const eDate = new Date(e.date + 'T00:00:00');
    return eDate.getMonth() === currentViewDate.getMonth() &&
           eDate.getFullYear() === currentViewDate.getFullYear();
  });

  if (monthExp.length === 0) {
    container.className = 'list-empty';
    container.innerHTML = `
      <span class="empty-icon">🛍️</span>
      <div>No expenses this month.</div>`;
    summaryBar.style.display = 'none';
    return;
  }

  container.className = '';
  const monthTotal = monthExp.reduce((s, e) => s + e.amount, 0);
  summaryBar.style.display = 'flex';
  summaryTotal.textContent = formatPesos(monthTotal);

  let html = '';
  monthExp.sort((a, b) => b.date < a.date ? -1 : 1).forEach((e, idx) => {
    html += `
    <div class="expense-item" style="animation-delay: ${idx * 0.05}s">
      <div class="expense-item-icon ${e.category}">${getCategoryEmoji(e.category)}</div>
      <div class="expense-item-info">
        <div class="expense-item-name">
          ${e.name}
          <span class="bill-category-tag ${e.category}">${e.category}</span>
        </div>
        <div class="expense-item-date">${formatDate(e.date)}${e.note ? ' — ' + e.note : ''}</div>
      </div>
      <div class="expense-item-amount">${formatPesos(e.amount)}</div>
      <div class="drop-item-actions">
        <button class="edit-btn" data-id="${e.id}" title="Edit">✎</button>
        <button class="delete-btn" data-id="${e.id}" title="Delete">✕</button>
      </div>
    </div>`;
  });

  container.innerHTML = html;
  container.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => editExpense(btn.dataset.id));
  });
  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteItem('expenses', btn.dataset.id));
  });
}

function renderSummary() {
  const container = document.getElementById('summaryContent');

  const monthIncome = data.cashDrops
    .filter(d => {
      const dDate = new Date(d.date + 'T00:00:00');
      return dDate.getMonth() === currentViewDate.getMonth() &&
             dDate.getFullYear() === currentViewDate.getFullYear();
    })
    .reduce((s, d) => s + d.amount, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthBillsDue = data.bills
    .filter(b => {
      if (b.paid) return false;
      if (!b.dueDate) return false;
      const bDate = new Date(b.dueDate + 'T00:00:00');
      if (bDate.getMonth() === currentViewDate.getMonth() &&
          bDate.getFullYear() === currentViewDate.getFullYear()) return true;
      if (bDate < new Date(today.getFullYear(), currentViewDate.getMonth(), 1)) return false;
      return false;
    })
    .reduce((s, b) => s + b.amount, 0);

  const monthExpenses = data.expenses
    .filter(e => {
      const eDate = new Date(e.date + 'T00:00:00');
      return eDate.getMonth() === currentViewDate.getMonth() &&
             eDate.getFullYear() === currentViewDate.getFullYear();
    })
    .reduce((s, e) => s + e.amount, 0);

  const balance = monthIncome - monthBillsDue - monthExpenses;

  container.innerHTML = `
    <div class="summary-card income">
      <span class="summary-card-icon">💰</span>
      <div class="summary-card-label">Cash In</div>
      <div class="summary-card-value">${formatPesos(monthIncome)}</div>
      <div class="summary-card-subtitle">${data.cashDrops.filter(d => {
        const dd = new Date(d.date+'T00:00:00');
        return dd.getMonth() === currentViewDate.getMonth() && dd.getFullYear() === currentViewDate.getFullYear();
      }).length} payday${data.cashDrops.filter(d => {
        const dd = new Date(d.date+'T00:00:00');
        return dd.getMonth() === currentViewDate.getMonth() && dd.getFullYear() === currentViewDate.getFullYear();
      }).length !== 1 ? 's' : ''}</div>
    </div>
    <div class="summary-card bills">
      <span class="summary-card-icon">📋</span>
      <div class="summary-card-label">Bills Due</div>
      <div class="summary-card-value">${formatPesos(monthBillsDue)}</div>
      <div class="summary-card-subtitle">${data.bills.filter(b => !b.paid && b.dueDate && new Date(b.dueDate+'T00:00:00').getMonth() === currentViewDate.getMonth() && new Date(b.dueDate+'T00:00:00').getFullYear() === currentViewDate.getMonth()).length} unpaid</div>
    </div>
    <div class="summary-card expenses">
      <span class="summary-card-icon">🛒</span>
      <div class="summary-card-label">Expenses</div>
      <div class="summary-card-value">${formatPesos(monthExpenses)}</div>
      <div class="summary-card-subtitle">${data.expenses.filter(e => {
        const ed = new Date(e.date+'T00:00:00');
        return ed.getMonth() === currentViewDate.getMonth() && ed.getFullYear() === currentViewDate.getFullYear();
      }).length} transaction${data.expenses.filter(e => {
        const ed = new Date(e.date+'T00:00:00');
        return ed.getMonth() === currentViewDate.getMonth() && ed.getFullYear() === currentViewDate.getFullYear();
      }).length !== 1 ? 's' : ''}</div>
    </div>
    <div class="summary-card balance ${balance < 0 ? 'negative' : ''}">
      <span class="summary-card-icon">${balance < 0 ? '⚠️' : '✅'}</span>
      <div class="summary-card-label">${balance < 0 ? 'Over Budget' : 'Remaining'}</div>
      <div class="summary-card-value">${balance < 0 ? '-' : ''}${formatPesos(Math.abs(balance))}</div>
      <div class="summary-card-subtitle">${balance < 0 ? 'Careful — you\'ve spent more than you have' : 'Safe to spend'}</div>
    </div>`;
}

function renderAll() {
  renderDate();
  renderDrops();
  renderBills();
  renderExpenses();
  renderSummary();
}

// ===== Modal Helpers =====
function openModal(html) {
  const overlay = document.getElementById('modalOverlay');
  const content = document.getElementById('modalContent');
  content.innerHTML = html;
  overlay.classList.remove('hidden');

  // Attach cancel handlers
  attachCancelHandlers();

  // Attach save handlers for all forms
  const saveBillBtn = document.getElementById('saveBill');
  if (saveBillBtn) {
    saveBillBtn.addEventListener('click', saveBillHandler);
  }
  const saveExpBtn = document.getElementById('saveExp');
  if (saveExpBtn) {
    saveExpBtn.addEventListener('click', saveExpHandler);
  }
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
  document.getElementById('modalContent').innerHTML = '';
}

// ===== Cash Drop =====
function getDefaultPaydayDate() {
  const d = new Date();
  if (d.getDate() <= 15) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-15';
  } else {
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + Math.min(30, lastDay);
  }
}

function getLastMonthHalfTotal() {
  const now = new Date();
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
  lastMonthEnd.setDate(0);
  const prevMonth = lastMonthEnd.getMonth();
  const prevYear = lastMonthEnd.getFullYear();

  const prevMonthDrops = data.cashDrops.filter(d => {
    const dd = new Date(d.date + 'T00:00:00');
    return dd.getMonth() === prevMonth && dd.getFullYear() === prevYear;
  });

  if (prevMonthDrops.length >= 2) {
    const total = prevMonthDrops.reduce((s, d) => s + d.amount, 0);
    return total / 2;
  }
  return null;
}

function openCashDropForm() {
  const dateInput = document.getElementById('dropDate');
  const amountInput = document.getElementById('dropAmount');

  if (!dateInput.value) {
    dateInput.value = getDefaultPaydayDate();
  }

  const halfLastMonth = getLastMonthHalfTotal();
  if (halfLastMonth !== null && !amountInput.value) {
    amountInput.value = halfLastMonth.toFixed(2);
    amountInput.setAttribute('placeholder', 'Confirm or edit');
  } else {
    amountInput.setAttribute('placeholder', '0.00');
  }
}

document.getElementById('addDropBtn').addEventListener('click', () => {
  openCashDropForm();

  const dateInput = document.getElementById('dropDate');
  const amountInput = document.getElementById('dropAmount');

  const date = dateInput.value;
  const amount = parseFloat(amountInput.value);

  if (!date) {
    animateShake(dateInput);
    return;
  }
  if (!amount || amount <= 0) {
    animateShake(amountInput);
    return;
  }

  data.cashDrops.push({
    id: 'd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    date,
    amount,
    note: ''
  });
  saveData(data);
  amountInput.value = '';
  amountInput.setAttribute('placeholder', '0.00');
  renderAll();
  animateValuePulse();
});

function animateShake(el) {
  el.style.animation = 'none';
  void el.offsetHeight;
  el.style.animation = 'shake 0.4s ease-out';
  el.style.borderColor = '#ef4444';
  setTimeout(() => {
    el.style.borderColor = '';
    el.style.animation = '';
  }, 500);
}

function animateValuePulse() {
  const values = document.querySelectorAll('.summary-card-value');
  values.forEach(v => {
    v.classList.remove('pulse');
    void v.offsetHeight;
    v.classList.add('pulse');
  });
}

// Add shake keyframe dynamically
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-6px); }
    40% { transform: translateX(6px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
  }
`;
document.head.appendChild(shakeStyle);

// ===== Bills =====
document.getElementById('addBillBtn').addEventListener('click', () => {
  openModal(buildBillForm(null));
});

document.getElementById('addExpenseBtn').addEventListener('click', () => {
  openModal(buildExpenseForm(null));
});

function buildBillForm(bill) {
  const isEdit = !!bill;

  return `
    <div class="modal-handle"></div>
    <h2 class="modal-title">${isEdit ? 'Edit Bill' : 'Add Bill'}</h2>
    <div class="modal-form">
      <div class="form-group">
        <label class="form-label" for="billName">Bill Name</label>
        <input type="text" id="billName" class="form-input"
          value="${escapeHtml(isEdit && bill.name ? bill.name : '')}"
          placeholder="e.g. Meralco Electric Bill" autocomplete="off">
      </div>
      <div class="form-group">
        <label class="form-label" for="billAmount">Amount (₱)</label>
        <input type="number" id="billAmount" class="form-input amount-input"
          value="${isEdit ? bill.amount : ''}" min="0" step="0.01" placeholder="0.00" inputmode="decimal">
      </div>
      <div class="form-group">
        <label class="form-label" for="billDueDate">Due Date</label>
        <input type="date" id="billDueDate" class="form-input date-input"
          value="${isEdit && bill.dueDate ? bill.dueDate : ''}">
      </div>
      <div class="form-group">
        <label class="form-label" for="billCategory">Category</label>
        <select id="billCategory" class="modal-select">
          ${['utilities', 'housing', 'food', 'transport', 'health', 'other'].map(c =>
            `<option value="${c}" ${isEdit && bill.category === c ? 'selected' : ''}>
              ${c.charAt(0).toUpperCase() + c.slice(1)}
            </option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="billNote">Note (optional)</label>
        <input type="text" id="billNote" class="form-input"
          value="${isEdit && bill.note ? escapeHtml(bill.note) : ''}"
          placeholder="e.g. Metered connection" autocomplete="off">
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn-cancel" id="cancelBill">Cancel</button>
      <button class="add-cash-btn" id="saveBill">${isEdit ? 'Update' : 'Add Bill'}</button>
    </div>`;
}

function buildExpenseForm(exp) {
  const isEdit = !!exp;
  const today = new Date().toISOString().slice(0, 10);

  return `
    <div class="modal-handle"></div>
    <h2 class="modal-title">${isEdit ? 'Edit Expense' : 'Add Expense'}</h2>
    <div class="modal-form">
      <div class="form-group">
        <label class="form-label" for="expName">Expense Name</label>
        <input type="text" id="expName" class="form-input"
          value="${escapeHtml(isEdit && exp.name ? exp.name : '')}"
          placeholder="e.g. Grocery at market" autocomplete="off">
      </div>
      <div class="form-group">
        <label class="form-label" for="expAmount">Amount (₱)</label>
        <input type="number" id="expAmount" class="form-input amount-input"
          value="${isEdit ? exp.amount : ''}" min="0" step="0.01" placeholder="0.00" inputmode="decimal">
      </div>
      <div class="form-group">
        <label class="form-label" for="expDate">Date</label>
        <input type="date" id="expDate" class="form-input date-input"
          value="${isEdit && exp.date ? exp.date : today}">
      </div>
      <div class="form-group">
        <label class="form-label" for="expCategory">Category</label>
        <select id="expCategory" class="modal-select">
          ${['food', 'transport', 'utilities', 'housing', 'health', 'other'].map(c =>
            `<option value="${c}" ${isEdit && exp.category === c ? 'selected' : ''}>
              ${c.charAt(0).toUpperCase() + c.slice(1)}
            </option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="expNote">Note (optional)</label>
        <input type="text" id="expNote" class="form-input"
          value="${isEdit && exp.note ? escapeHtml(exp.note) : ''}"
          placeholder="e.g. Weekly groceries" autocomplete="off">
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn-cancel" id="cancelExp">Cancel</button>
      <button class="add-cash-btn" id="saveExp">${isEdit ? 'Update' : 'Add Expense'}</button>
    </div>`;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== Save Handlers =====
function saveBillHandler() {
  const name = document.getElementById('billName').value.trim();
  const amount = parseFloat(document.getElementById('billAmount').value);
  const dueDate = document.getElementById('billDueDate').value;
  const category = document.getElementById('billCategory').value;
  const note = document.getElementById('billNote').value.trim();

  if (!name) {
    animateShake(document.getElementById('billName'));
    return;
  }
  if (!amount || amount <= 0) {
    animateShake(document.getElementById('billAmount'));
    return;
  }
  if (!dueDate) {
    animateShake(document.getElementById('billDueDate'));
    return;
  }

  if (editingBillId) {
    const idx = data.bills.findIndex(b => b.id === editingBillId);
    if (idx !== -1) {
      data.bills[idx] = { ...data.bills[idx], name, amount, dueDate, category, note, paid: false, paidDate: null };
    }
  } else {
    data.bills.push({
      id: 'b_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name, amount, dueDate, category, note,
      paid: false, paidDate: null
    });
  }

  saveData(data);
  closeModal();
  renderAll();
  animateValuePulse();
  // Clear form fields
  document.getElementById('billName').value = '';
  document.getElementById('billAmount').value = '';
  document.getElementById('billDueDate').value = '';
  document.getElementById('billCategory').value = 'utilities';
  document.getElementById('billNote').value = '';
}

function saveExpHandler() {
  const name = document.getElementById('expName').value.trim();
  const amount = parseFloat(document.getElementById('expAmount').value);
  const date = document.getElementById('expDate').value;
  const category = document.getElementById('expCategory').value;
  const note = document.getElementById('expNote').value.trim();

  if (!name) {
    animateShake(document.getElementById('expName'));
    return;
  }
  if (!amount || amount <= 0) {
    animateShake(document.getElementById('expAmount'));
    return;
  }
  if (!date) {
    animateShake(document.getElementById('expDate'));
    return;
  }

  if (editingExpenseId) {
    const idx = data.expenses.findIndex(e => e.id === editingExpenseId);
    if (idx !== -1) {
      data.expenses[idx] = { ...data.expenses[idx], name, amount, date, category, note };
    }
  } else {
    data.expenses.push({
      id: 'e_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name, amount, date, category, note
    });
  }

  saveData(data);
  closeModal();
  renderAll();
  animateValuePulse();
  // Clear form fields
  document.getElementById('expName').value = '';
  document.getElementById('expAmount').value = '';
  document.getElementById('expDate').value = '';
  document.getElementById('expCategory').value = 'food';
  document.getElementById('expNote').value = '';
}

// ===== Cancel Buttons (attached in openModal) =====
function attachCancelHandlers() {
  const cancelBill = document.getElementById('cancelBill');
  const cancelExp = document.getElementById('cancelExp');
  if (cancelBill) cancelBill.addEventListener('click', closeModal);
  if (cancelExp) cancelExp.addEventListener('click', closeModal);
}

// ===== Editing =====
function editBill(id) {
  const bill = data.bills.find(b => b.id === id);
  if (!bill) return;
  editingBillId = id;
  openModal(buildBillForm(bill));
}

function editExpense(id) {
  const exp = data.expenses.find(e => e.id === id);
  if (!exp) return;
  editingExpenseId = id;
  openModal(buildExpenseForm(exp));
}

// ===== Delete & Toggle =====
function deleteItem(collection, id) {
  if (!confirm('Delete this item?')) return;
  data[collection] = data[collection].filter(item => item.id !== id);
  saveData(data);
  renderAll();
  animateValuePulse();
}

function toggleBillPaid(id) {
  const bill = data.bills.find(b => b.id === id);
  if (!bill) return;
  if (bill.paid) {
    bill.paid = false;
    bill.paidDate = null;
  } else {
    bill.paid = true;
    bill.paidDate = new Date().toISOString().slice(0, 10);
  }
  saveData(data);
  renderAll();
  animateValuePulse();
}

// ===== Month Navigation =====
document.getElementById('prevMonth').addEventListener('click', () => {
  const d = new Date(currentViewDate);
  d.setMonth(d.getMonth() - 1);
  currentViewDate = d;
  animateMonthChange();
  renderAll();
});

document.getElementById('nextMonth').addEventListener('click', () => {
  const d = new Date(currentViewDate);
  d.setMonth(d.getMonth() + 1);
  currentViewDate = d;
  animateMonthChange();
  renderAll();
});

function animateMonthChange() {
  const label = document.getElementById('monthYear');
  label.style.animation = 'none';
  void label.offsetHeight;
  label.style.animation = 'monthFlip 0.35s var(--ease-out)';
}

const monthFlipStyle = document.createElement('style');
monthFlipStyle.textContent = `
  @keyframes monthFlip {
    0% { transform: rotateX(0); opacity: 1; }
    50% { transform: rotateX(-90deg); opacity: 0; }
    100% { transform: rotateX(0); opacity: 1; }
  }
`;
document.head.appendChild(monthFlipStyle);

// ===== Tab Bar =====
function initTabs() {
  const tabBar = document.getElementById('tabBar');
  if (!tabBar) return;

  const contentSections = {
    income: document.querySelector('.cash-drop-section'),
    bills: document.querySelector('.bills-section'),
    expenses: document.querySelector('.expenses-section')
  };
  const summarySection = document.querySelector('.summary-section');

  function setActiveTab(tabId) {
    tabBar.querySelectorAll('.tab-item').forEach(btn => {
      const isActive = btn.dataset.tab === tabId;
      btn.classList.toggle('active', isActive);
      btn.classList.toggle('inactive', !isActive);
    });

    if (summarySection) summarySection.style.display = '';

    Object.entries(contentSections).forEach(([key, el]) => {
      if (!el) return;
      el.style.display = (key === tabId) ? '' : 'none';
    });
  }

  tabBar.querySelectorAll('.tab-item').forEach(btn => {
    btn.addEventListener('click', () => {
      setActiveTab(btn.dataset.tab);
    });
  });

  setActiveTab('income');
}

// ===== Init =====
renderAll();
initTabs();

// Add subtle entrance stagger to sections
document.querySelectorAll('.cash-drop-section, .drop-items-section, .bills-section, .expenses-section, .summary-section').forEach((el, i) => {
  el.style.animationDelay = `${0.1 + i * 0.08}s`;
});
