/**
 * MAYAACC — Step 0: Foundation
 * src/renderer/js/wizard.js — company creation wizard.
 *
 * 4 steps as REAL tabs (clickable, active tab is dark navy).
 * Address: Enter = new line, Enter twice = next field.
 * Security: password protection ON/OFF per company.
 */
'use strict';

const Wizard = (() => {
  const TABS = ['details', 'tax', 'accounting', 'security'];
  let currentTab = 'details';

  function fillStateSelects() {
    for (const id of ['c-state', 'c-pos']) {
      const sel = $('#' + id);
      sel.innerHTML = '';
      for (const st of INDIAN_STATES) {
        const opt = document.createElement('option');
        opt.value = st;
        opt.textContent = st;
        sel.appendChild(opt);
      }
      sel.value = 'Haryana';
    }
  }

  function showTab(name) {
    currentTab = name;
    $$('.wizard-tab').forEach((tab) => {
      const active = tab.dataset.tab === name;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    $$('.wizard-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.dataset.panel === name);
    });
    const idx = TABS.indexOf(name);
    $('#wizard-back').disabled = idx === 0;
    $('#wizard-next').textContent = idx === TABS.length - 1 ? 'Create Company ✓' : 'Next →';
    // Focus the first field of the panel so keyboard users can start typing.
    const panel = $('.wizard-panel[data-panel="' + name + '"]');
    const first = panel && panel.querySelector('input, select, textarea');
    if (first) setTimeout(() => first.focus(), 0);
  }

  function next() {
    const idx = TABS.indexOf(currentTab);
    if (idx < TABS.length - 1) showTab(TABS[idx + 1]);
    else createCompany();
  }

  function back() {
    const idx = TABS.indexOf(currentTab);
    if (idx > 0) showTab(TABS[idx - 1]);
  }

  function setError(msg, tab) {
    $('#wizard-error').textContent = msg;
    if (tab && tab !== currentTab) showTab(tab);
  }

  async function createCompany() {
    const name = $('#c-name').value.trim();
    if (!name) {
      setError('Company Name is required.', 'details');
      $('#c-name').focus();
      return;
    }
    const fyStart = $('#c-fystart').value;
    const booksFrom = $('#c-booksfrom').value;
    if (!fyStart || !booksFrom) {
      setError('Financial Year Start and Books Beginning From are required.', 'accounting');
      return;
    }
    if (booksFrom < fyStart) {
      setError('Books Beginning From cannot be before the Financial Year Start.', 'accounting');
      return;
    }
    const gstin = $('#c-gstin').value.trim().toUpperCase();
    if (gstin && gstin.length !== 15) {
      setError('GSTIN must be 15 characters.', 'tax');
      $('#c-gstin').focus();
      return;
    }
    const pan = $('#c-pan').value.trim().toUpperCase();
    if (pan && pan.length !== 10) {
      setError('PAN must be 10 characters.', 'tax');
      $('#c-pan').focus();
      return;
    }

    const securityOn = $('#c-pwdsecurity').checked;
    let companyPasswordHash = '';
    let companySalt = '';
    if (securityOn) {
      const pwd = $('#c-pwd').value;
      const pwdConfirm = $('#c-pwdconfirm').value;
      if (pwd.length < 4) {
        setError('Company password must be at least 4 characters.', 'security');
        $('#c-pwd').focus();
        return;
      }
      if (pwd !== pwdConfirm) {
        setError('Company passwords do not match.', 'security');
        $('#c-pwdconfirm').focus();
        return;
      }
      companySalt = randomSaltHex();
      companyPasswordHash = await hashPassword(pwd, companySalt);
    }

    const company = {
      id: uid('c'),
      name,
      mailingName: $('#c-mailing').value.trim(),
      address: $('#c-address').value.trim(),
      state: $('#c-state').value,
      country: $('#c-country').value.trim() || 'India',
      phone: $('#c-phone').value.trim(),
      mobile: $('#c-mobile').value.trim(),
      email: $('#c-email').value.trim(),
      website: $('#c-website').value.trim(),
      gstin,
      pan,
      taxType: $('#c-taxtype').value,
      gstDate: $('#c-gstdate').value || '',
      placeOfSupply: $('#c-pos').value,
      fyStart,
      fyEnd: fyEndOf(fyStart),
      booksFrom,
      currency: $('#c-currency').value,
      decimals: parseInt($('#c-decimals').value, 10),
      passwordSecurity: securityOn,
      companyPasswordHash,
      companySalt,
      createdAt: new Date().toISOString(),
      transactions: [],
    };

    Store.data.companies.push(company);
    // New company's year becomes the working period.
    Store.data.currentPeriod = { from: fyStart, to: fyEndOf(fyStart) };
    await Store.save();
    resetForm();
    CompanySelect.showCreated(name);
    CompanySelect.show();
  }

  function resetForm() {
    $('#wizard-form').reset();
    $('#c-country').value = 'India';
    $('#c-fystart').value = '2026-04-01';
    $('#c-booksfrom').value = '2026-04-01';
    $('#c-state').value = 'Haryana';
    $('#c-pos').value = 'Haryana';
    toggleSecurityFields(false);
    setError('');
    showTab('details');
  }

  function toggleSecurityFields(on) {
    $('#c-pwd').disabled = !on;
    $('#c-pwdconfirm').disabled = !on;
    if (!on) { $('#c-pwd').value = ''; $('#c-pwdconfirm').value = ''; }
  }

  function show() {
    resetForm();
    App.showScreen('screen-wizard');
  }

  function init() {
    fillStateSelects();

    $$('.wizard-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        setError('');
        showTab(tab.dataset.tab);
      });
    });

    $('#wizard-next').addEventListener('click', next);
    $('#wizard-back').addEventListener('click', back);
    $('#wizard-cancel').addEventListener('click', () => CompanySelect.show());
    $('#wizard-cancel-top').addEventListener('click', () => CompanySelect.show());

    // Security toggle enables/disables the password fields.
    $('#c-pwdsecurity').addEventListener('change', (e) => {
      toggleSecurityFields(e.target.checked);
      if (e.target.checked) setTimeout(() => $('#c-pwd').focus(), 0);
    });

    // Address: Enter = new line, Enter twice (in a row) = next field.
    // First Enter inserts the newline (default); second Enter, with nothing
    // typed in between, removes that trailing newline and moves on.
    const addressEl = $('#c-address');
    let enterArmed = false;
    addressEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (enterArmed) {
          e.preventDefault();
          enterArmed = false;
          if (addressEl.value.endsWith('\n')) {
            addressEl.value = addressEl.value.slice(0, -1);
            addressEl.dispatchEvent(new Event('input', { bubbles: true }));
          }
          $('#c-state').focus();
        } else {
          enterArmed = true;
        }
      } else {
        enterArmed = false;
      }
    });
    addressEl.addEventListener('blur', () => { enterArmed = false; });

    // Prevent the form from submitting (and reloading) on Enter.
    $('#wizard-form').addEventListener('submit', (e) => e.preventDefault());
  }

  return { init, show, showTab };
})();
