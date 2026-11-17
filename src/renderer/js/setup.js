/**
 * MAYAACC — Step 0: Foundation
 * src/renderer/js/setup.js — first-run-only setup.
 * Username + password, salted SHA-256, stored locally.
 * After this, the app opens straight to Select Company — no login screen.
 */
'use strict';

const Setup = (() => {
  function show() {
    App.showScreen('screen-setup');
    setTimeout(() => $('#setup-username').focus(), 0);
  }

  function init() {
    $('#setup-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = $('#setup-username').value.trim();
      const password = $('#setup-password').value;
      const confirm = $('#setup-confirm').value;
      const errEl = $('#setup-error');

      if (username.length < 3) {
        errEl.textContent = 'Username must be at least 3 characters.';
        $('#setup-username').focus();
        return;
      }
      if (password.length < 4) {
        errEl.textContent = 'Password must be at least 4 characters.';
        $('#setup-password').focus();
        return;
      }
      if (password !== confirm) {
        errEl.textContent = 'Passwords do not match.';
        $('#setup-confirm').focus();
        return;
      }
      errEl.textContent = '';

      const salt = randomSaltHex();
      const hash = await hashPassword(password, salt);
      Store.data.settings = { setupDone: true, username, passwordHash: hash, salt };
      await Store.save();
      CompanySelect.show();
    });
  }

  return { init, show };
})();
