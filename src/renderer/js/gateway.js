/**
 * MAYAACC — Step 0: Foundation
 * src/renderer/js/gateway.js — main screen (Gateway of MAYAACC).
 *
 * F2 = Change Date, Alt+F2 = Change Period (keyboard only — no button
 * on this screen for them). F3 = Select Company. Esc = back to
 * Select Company. Last Activity is computed from real data.
 */
'use strict';

const Gateway = (() => {
  function current() {
    return Store.currentCompany();
  }

  function open(companyId) {
    Store.data.currentCompanyId = companyId;
    Store.save();
    render();
    App.showScreen('screen-gateway');
  }

  function render() {
    const c = current();
    if (!c) { CompanySelect.show(); return; }

    $('#gateway-company-sub').textContent = 'Gateway — ' + c.name;
    $('#gateway-meta').innerHTML = '';
    const metaDate = document.createElement('div');
    metaDate.textContent = 'Date: ' + fmtDate(Store.data.currentDate);
    const metaPeriod = document.createElement('div');
    metaPeriod.textContent = 'Period: ' + fmtDate(Store.data.currentPeriod.from) +
      ' to ' + fmtDate(Store.data.currentPeriod.to);
    $('#gateway-meta').appendChild(metaDate);
    $('#gateway-meta').appendChild(metaPeriod);

    $('#gw-company-name').textContent = c.name;
    $('#gw-company-line').textContent =
      [c.mailingName, c.address, c.state, c.country].filter(Boolean).join(', ') ||
      'No address on record';
    $('#gw-date').textContent = fmtDate(Store.data.currentDate);
    $('#gw-period').textContent =
      fmtDate(Store.data.currentPeriod.from) + ' to ' + fmtDate(Store.data.currentPeriod.to);
    $('#gw-fy').textContent = 'FY ' + fyLabel(c.fyStart) +
      '  (' + fmtDate(c.fyStart) + ' to ' + fmtDate(c.fyEnd) + ')';

    const la = Store.lastActivity(c);
    const laEl = $('#gw-last-activity');
    if (la) {
      laEl.textContent = fmtDate(la);
      laEl.classList.remove('activity-none');
    } else {
      laEl.textContent = 'No transactions yet';
      laEl.classList.add('activity-none');
    }

    $('#gw-gstin').textContent = c.gstin || '—';
    $('#gw-pan').textContent = c.pan || '—';
    $('#gw-taxtype').textContent = c.taxType || '—';
    $('#gw-currency').textContent = c.currency === 'INR' ? 'INR — Indian Rupee (₹)'
      : (c.currency || '—');
  }

  function openChangeDate() {
    const c = current();
    Dialogs.openDate(
      Store.data.currentDate,
      async (iso) => {
        Store.data.currentDate = iso;
        await Store.save();
        render();
      },
      // Tally rule: working date stays inside the company's financial year.
      (iso) => {
        if (c && (iso < c.fyStart || iso > c.fyEnd)) {
          return 'Date must be inside the financial year (' +
            fmtDate(c.fyStart) + ' to ' + fmtDate(c.fyEnd) + ').';
        }
        return '';
      }
    );
  }

  function openChangePeriod() {
    Dialogs.openPeriod(Store.data.currentPeriod, async (period) => {
      Store.data.currentPeriod = period;
      await Store.save();
      render();
    });
  }

  function init() {
    $('#menu-select-company').addEventListener('click', () => CompanySelect.show());
    $('#menu-new-company').addEventListener('click', () => Wizard.show());
  }

  return { init, open, render, openChangeDate, openChangePeriod };
})();
