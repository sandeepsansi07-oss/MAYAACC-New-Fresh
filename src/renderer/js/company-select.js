/**
 * MAYAACC — Step 0: Foundation
 * src/renderer/js/company-select.js — Select Company screen.
 * Lists companies with FY and Last Activity (computed from real data).
 */
'use strict';

const CompanySelect = (() => {
  let createdMessage = '';

  function show() {
    render();
    App.showScreen('screen-companies');
  }

  function showCreated(name) {
    createdMessage = 'Company "' + name + '" created.';
  }

  function render() {
    const listEl = $('#company-list');
    listEl.innerHTML = '';
    const companies = Store.data.companies || [];
    $('#company-empty').classList.toggle('hidden', companies.length > 0);

    for (const c of companies) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'company-row';
      btn.dataset.id = c.id;
      const la = Store.lastActivity(c);
      const nameSpan = document.createElement('span');
      nameSpan.className = 'cr-name';
      nameSpan.textContent = c.name;
      const metaSpan = document.createElement('span');
      metaSpan.className = 'cr-meta';
      metaSpan.textContent =
        'FY ' + fyLabel(c.fyStart) +
        '  ·  Last Activity: ' + (la ? fmtDate(la) : 'No transactions yet');
      btn.appendChild(nameSpan);
      btn.appendChild(metaSpan);
      btn.addEventListener('click', () => Gateway.open(c.id));
      listEl.appendChild(btn);
    }

    $('#companies-meta').textContent =
      'Date: ' + fmtDate(Store.data.currentDate) +
      '   ·   Period: ' + fmtDate(Store.data.currentPeriod.from) +
      ' to ' + fmtDate(Store.data.currentPeriod.to);

    $('#companies-sub').textContent =
      createdMessage || 'Choose a company to open, or create a new one.';
    createdMessage = '';
  }

  function init() {
    $('#btn-new-company').addEventListener('click', () => Wizard.show());
  }

  return { init, show, showCreated };
})();
