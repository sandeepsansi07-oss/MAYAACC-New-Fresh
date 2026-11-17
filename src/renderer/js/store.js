/**
 * MAYAACC — Step 0: Foundation
 * src/renderer/js/store.js — data layer.
 *
 * Electron mode (real app): data lives in
 *   Documents\MAYAACC-Data\mayaacc-data.json
 * via window.mayaaccDesktop (preload bridge). Same file, updated in place.
 *
 * Browser mode (verification on this VM): window.mayaaccDesktop is absent,
 * so the same code persists to localStorage under one key — the same
 * "one file, updated in place" behaviour, and the status bar shows the
 * Windows path the file will have on the user's PC.
 */
'use strict';

const Store = (() => {
  const LS_KEY = 'mayaacc-data-v1';
  const LS_SAVED_AT = 'mayaacc-data-v1:savedAt';
  // Path the file has on Windows (the real product target).
  const WIN_DISPLAY_PATH = 'Documents\\MAYAACC-Data\\mayaacc-data.json';

  let mode = 'browser';
  let data = null;
  let displayPath = WIN_DISPLAY_PATH;
  let lastSavedAt = null;

  function defaultData() {
    return {
      version: '0.1.0',
      settings: { setupDone: false, username: '', passwordHash: '', salt: '' },
      companies: [],
      currentCompanyId: null,
      currentDate: todayISO(),
      currentPeriod: { from: '2026-04-01', to: '2027-03-31' },
    };
  }

  async function init() {
    if (window.mayaaccDesktop) {
      mode = 'electron';
      const paths = await window.mayaaccDesktop.getPaths();
      displayPath = paths.displayPath;
      const raw = await window.mayaaccDesktop.loadData();
      data = raw ? JSON.parse(raw) : defaultData();
    } else {
      mode = 'browser';
      const raw = localStorage.getItem(LS_KEY);
      data = raw ? JSON.parse(raw) : defaultData();
      lastSavedAt = localStorage.getItem(LS_SAVED_AT);
    }
    renderStatus('Ready', false);
    return data;
  }

  function serialize() {
    return JSON.stringify(data, null, 2);
  }

  async function save() {
    renderStatus('Saving…', true);
    const text = serialize();
    if (mode === 'electron') {
      const res = await window.mayaaccDesktop.saveData(text);
      lastSavedAt = res.savedAt;
    } else {
      localStorage.setItem(LS_KEY, text);
      lastSavedAt = new Date().toISOString();
      localStorage.setItem(LS_SAVED_AT, lastSavedAt);
    }
    renderStatus('Saved', false);
    return lastSavedAt;
  }

  function renderStatus(state, saving) {
    const stateEl = $('#sb-state');
    if (!stateEl) return;
    stateEl.textContent = state;
    stateEl.classList.toggle('saving', !!saving);
    const pathEl = $('#sb-path');
    pathEl.textContent = displayPath;
    pathEl.title = displayPath;
    $('#sb-time').textContent = lastSavedAt
      ? 'Last saved: ' + fmtDateTime(lastSavedAt)
      : 'Not saved yet';
  }

  function getCompany(id) {
    return (data.companies || []).find((c) => c.id === id) || null;
  }

  function currentCompany() {
    return getCompany(data.currentCompanyId);
  }

  /**
   * Last Activity — computed from REAL data: the latest transaction date
   * of the company. Returns an ISO date string, or null when the company
   * has no transactions yet.
   */
  function lastActivity(company) {
    if (!company || !Array.isArray(company.transactions) || company.transactions.length === 0) {
      return null;
    }
    let max = null;
    for (const t of company.transactions) {
      if (t && t.date && (!max || t.date > max)) max = t.date;
    }
    return max;
  }

  async function openDataFolder() {
    if (mode === 'electron') {
      await window.mayaaccDesktop.openDataFolder();
      return;
    }
    // Browser mode: no Explorer to open — say so in the status bar.
    const stateEl = $('#sb-state');
    const prev = stateEl.textContent;
    stateEl.textContent = 'On Windows this opens: ' + displayPath;
    setTimeout(() => { stateEl.textContent = prev; }, 3000);
  }

  return {
    init, save, getCompany, currentCompany, lastActivity, openDataFolder,
    get data() { return data; },
    get mode() { return mode; },
    get displayPath() { return displayPath; },
    get lastSavedAt() { return lastSavedAt; },
  };
})();
