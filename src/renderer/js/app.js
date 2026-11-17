/**
 * MAYAACC — Step 0: Foundation
 * src/renderer/js/app.js — boot + screen router + global keys.
 *
 * Global keyboard (main screen only):
 *   F2      = Change Date      (keyboard only, no button)
 *   Alt+F2  = Change Period    (keyboard only, no button)
 *   F3      = Select Company
 *   Esc     = back (gateway -> companies, wizard -> companies, dialog -> close)
 *
 * Focus rule: whenever a field gets focus, scroll it into the centre
 * of the view so typing is never hidden below the fold.
 */
'use strict';

const App = (() => {
  let screen = null;

  function showScreen(id) {
    $$('.screen').forEach((s) => s.classList.add('hidden'));
    const el = document.getElementById(id);
    el.classList.remove('hidden');
    screen = id;
    // Keep keyboard focus on the workspace, not on a clicked button,
    // so shortcuts keep working after a mouse click.
    if (document.activeElement && document.activeElement.blur) {
      const tag = document.activeElement.tagName;
      if (tag === 'BUTTON') document.activeElement.blur();
    }
  }

  function currentScreen() { return screen; }

  function onKeyDown(e) {
    if (Dialogs.isOpen()) return; // dialogs handle their own keys
    // A key already handled (and preventDefaulted) by another module's
    // listener — e.g. Masters navigating on Esc — must not be re-read
    // here against the screen it just navigated to.
    if (e.defaultPrevented) return;

    if (screen === 'screen-gateway') {
      if (e.key === 'F2' && e.altKey) {
        e.preventDefault();
        Gateway.openChangePeriod();
      } else if (e.key === 'F2') {
        e.preventDefault();
        Gateway.openChangeDate();
      } else if (e.key === 'F3') {
        e.preventDefault();
        CompanySelect.show();
      } else if (e.key === 'Escape') {
        CompanySelect.show();
      }
    } else if (screen === 'screen-wizard') {
      if (e.key === 'Escape') CompanySelect.show();
    }
  }

  async function boot() {
    await Store.init();
    Dialogs.init();
    Setup.init();
    CompanySelect.init();
    Wizard.init();
    Gateway.init();
    Masters.init();

    // Field scrolls into centre view on focus (typing never hides).
    document.addEventListener('focusin', (e) => {
      const t = e.target;
      if (t && t.matches && t.matches('input, textarea, select')) {
        t.scrollIntoView({ block: 'center' });
      }
    });

    document.addEventListener('keydown', onKeyDown);

    $('#sb-open-folder').addEventListener('click', () => Store.openDataFolder());

    if (!Store.data.settings.setupDone) {
      Setup.show();
    } else {
      CompanySelect.show();
    }
  }

  return { showScreen, currentScreen, boot };
})();

App.boot();
