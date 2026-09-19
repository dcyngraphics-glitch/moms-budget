// ---------- Init ----------

function init() {
  ensureAccounts();
  appData = loadData() || { cashDrops: [], bills: [], expenses: [] };
  initNavigation();
  updateHeaderTitle();
  render();

  // If viewYear/viewMonth is in the future (near end of month), keep current
  // Already initialized to current month above
}
