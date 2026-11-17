/**
 * MAYAACC — Step 0: Foundation
 * test/verify-step0.mjs — REAL-BROWSER verification (Playwright + Chromium).
 *
 * Serves src/renderer on http://127.0.0.1:8902 and drives it with real
 * mouse clicks, real typing and real shortcuts, exactly as the user would.
 * Screenshots land in test/screenshots-step0/.
 *
 * Run: npm run verify
 */
'use strict';

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', 'src', 'renderer');
const SHOTS = path.join(__dirname, 'screenshots-step0');
const PORT = 8902;
const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';

fs.mkdirSync(SHOTS, { recursive: true });

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

let pass = 0;
let fail = 0;
const failures = [];
function check(name, ok, extra) {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; failures.push(name); console.log('  FAIL  ' + name + (extra ? ' — ' + extra : '')); }
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, name + '.png') });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
console.log('Serving renderer on http://127.0.0.1:' + PORT);

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

let pageErrors = [];
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
page.on('pageerror', (err) => pageErrors.push(String(err)));
page.on('console', (msg) => { if (msg.type() === 'error') pageErrors.push('console: ' + msg.text()); });

const URL = `http://127.0.0.1:${PORT}/index.html`;

try {
  // ---------- S1: first run shows SETUP ----------
  await page.goto(URL, { waitUntil: 'load' });
  await sleep(300);
  check('S1 first run shows the Setup screen', await page.isVisible('#screen-setup'));
  await shot(page, '01-setup-first-run');

  // ---------- S18: setup validation ----------
  await page.click('#setup-submit');
  const setupErr1 = await page.textContent('#setup-error');
  check('S18a empty setup submit shows an error', (setupErr1 || '').length > 5, setupErr1);
  await page.click('#setup-username'); await page.keyboard.type('sandeep');
  await page.click('#setup-password'); await page.keyboard.type('pass1234');
  await page.click('#setup-confirm'); await page.keyboard.type('different');
  await page.click('#setup-submit');
  const setupErr2 = await page.textContent('#setup-error');
  check('S18b mismatched passwords show an error', /match/i.test(setupErr2 || ''), setupErr2);
  await page.click('#setup-confirm'); await page.keyboard.press('Control+A'); await page.keyboard.type('pass1234');
  await page.click('#setup-submit');
  await sleep(400);
  check('S1b after setup, Select Company screen shows', await page.isVisible('#screen-companies'));
  await shot(page, '02-after-setup');

  // stored setup hash: salted SHA-256, never the plain password
  const stored = JSON.parse(await page.evaluate(() => localStorage.getItem('mayaacc-data-v1')));
  check('S16a setup password stored as 64-hex SHA-256 hash (not plain text)',
    /^[0-9a-f]{64}$/.test(stored.settings.passwordHash || '') &&
    stored.settings.passwordHash !== 'pass1234' &&
    (stored.settings.salt || '').length >= 16);
  check('S16b setupDone is true', stored.settings.setupDone === true);

  // ---------- S2: reload goes straight to Select Company (no login) ----------
  await page.reload({ waitUntil: 'load' });
  await sleep(300);
  check('S2 reload opens straight to Select Company (no login/setup screen)',
    (await page.isVisible('#screen-companies')) && !(await page.isVisible('#screen-setup')));
  await shot(page, '03-reload-select-company');

  // ---------- S3: wizard tabs are real + dark ----------
  await page.click('#btn-new-company');
  await sleep(200);
  check('S3a wizard opens on Company Details tab',
    await page.isVisible('#screen-wizard') &&
    (await page.getAttribute('.wizard-tab[data-tab="details"]', 'class') || '').includes('active'));
  for (const tab of ['tax', 'accounting', 'security', 'details']) {
    await page.click(`.wizard-tab[data-tab="${tab}"]`);
    await sleep(120);
    const cls = await page.getAttribute(`.wizard-tab[data-tab="${tab}"]`, 'class') || '';
    const bg = await page.evaluate((t) => {
      const el = document.querySelector(`.wizard-tab[data-tab="${t}"]`);
      return getComputedStyle(el).backgroundColor;
    }, tab);
    const panelVisible = await page.isVisible(`.wizard-panel[data-panel="${tab}"]`);
    check(`S3b tab "${tab}" clickable, dark active state, panel shows`,
      cls.includes('active') && bg === 'rgb(22, 35, 63)' && panelVisible, 'bg=' + bg);
  }
  await shot(page, '04-wizard-tabs');

  // ---------- S4: typing works in every field ----------
  await page.click('.wizard-tab[data-tab="details"]');
  const typeInto = async (sel, text) => {
    await page.click(sel);
    await page.keyboard.type(text);
    return (await page.inputValue(sel)) === text;
  };
  check('S4a typing lands in Company Name', await typeInto('#c-name', 'Sharma Traders'));
  check('S4b typing lands in Mailing Name', await typeInto('#c-mailing', 'Sharma Traders'));
  check('S4c typing lands in Phone', await typeInto('#c-phone', '9812345678'));
  check('S4d typing lands in Mobile', await typeInto('#c-mobile', '9812345679'));
  check('S4e typing lands in Email', await typeInto('#c-email', 'sharma@example.com'));
  check('S4f typing lands in Website', await typeInto('#c-website', 'sharmatraders.in'));

  // ---------- S5: address double-Enter ----------
  await page.click('#c-address');
  await page.keyboard.type('Shop 12');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Main Road');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter'); // second consecutive Enter -> next field
  await sleep(150);
  const addrVal = await page.inputValue('#c-address');
  const focusedId = await page.evaluate(() => document.activeElement && document.activeElement.id);
  check('S5a double-Enter in Address moves focus to the next field (State)',
    focusedId === 'c-state', 'focused=' + focusedId);
  check('S5b address keeps lines, no trailing blank line',
    addrVal === 'Shop 12\nMain Road', JSON.stringify(addrVal));

  // ---------- S4 continued: tax + accounting fields ----------
  await page.click('.wizard-tab[data-tab="tax"]');
  check('S4g typing lands in GSTIN', await typeInto('#c-gstin', '06ABCDE1234F1Z5'));
  check('S4h typing lands in PAN', await typeInto('#c-pan', 'ABCDE1234F'));
  await page.click('.wizard-tab[data-tab="accounting"]');
  const fy = await page.inputValue('#c-fystart');
  check('S4i FY start date field holds its value', fy === '2026-04-01', fy);
  await shot(page, '05-wizard-filled');

  // ---------- S17: validation — empty name blocks create ----------
  await page.click('.wizard-tab[data-tab="details"]');
  await page.click('#c-name'); await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace');
  await page.click('.wizard-tab[data-tab="security"]');
  await page.click('#wizard-next'); // Create Company
  await sleep(200);
  const wizErr = await page.textContent('#wizard-error');
  check('S17 empty Company Name blocks creation with an error',
    /required/i.test(wizErr || '') && await page.isVisible('#screen-wizard'), wizErr);
  await page.click('#c-name'); await page.keyboard.type('Sharma Traders');

  // ---------- S7: create company -> list -> gateway ----------
  await page.click('.wizard-tab[data-tab="security"]');
  await page.click('#wizard-next');
  await sleep(400);
  check('S7a company created, back on Select Company',
    await page.isVisible('#screen-companies'));
  const rowText = await page.textContent('#company-list');
  check('S7b new company appears in the list', /Sharma Traders/.test(rowText || ''), rowText);
  await shot(page, '06-company-list');
  await page.click('.company-row');
  await sleep(300);
  check('S7c clicking the company opens the Gateway main screen',
    await page.isVisible('#screen-gateway'));
  const gwName = await page.textContent('#gw-company-name');
  check('S7d gateway shows the company name', (gwName || '').trim() === 'Sharma Traders', gwName);
  const laText = await page.textContent('#gw-last-activity');
  check('S7e Last Activity shows "No transactions yet" for a fresh company',
    /No transactions yet/.test(laText || ''), laText);
  await shot(page, '07-gateway');

  // ---------- S8: status bar ----------
  const sbState = await page.textContent('#sb-state');
  const sbPath = await page.textContent('#sb-path');
  const sbTime = await page.textContent('#sb-time');
  check('S8a status bar shows Saved', /Saved/.test(sbState || ''), sbState);
  check('S8b status bar shows the real data path',
    /MAYAACC-Data/.test(sbPath || '') && /mayaacc-data\.json/.test(sbPath || ''), sbPath);
  check('S8c status bar shows a last-saved time', /Last saved:/.test(sbTime || ''), sbTime);

  // ---------- S9: F2 Change Date ----------
  await page.keyboard.press('F2');
  await sleep(200);
  check('S9a F2 opens the Change Date dialog', await page.isVisible('#dlg-change-date'));
  await shot(page, '08-change-date-dialog');
  await page.fill('#dlg-date-input', '2026-11-10');
  await page.keyboard.press('Enter');
  await sleep(300);
  const gwDate = await page.textContent('#gw-date');
  check('S9b Enter applies the new date (10-Nov-2026)',
    (gwDate || '').trim() === '10-Nov-2026', gwDate);
  check('S9c dialog closed after applying', !(await page.isVisible('#dlg-change-date')));

  // ---------- S11: Esc closes a dialog without applying ----------
  await page.keyboard.press('F2');
  await sleep(150);
  await page.fill('#dlg-date-input', '2026-11-12');
  await page.keyboard.press('Escape');
  await sleep(150);
  const gwDate2 = await page.textContent('#gw-date');
  check('S11 Esc closes the dialog and the date stays 10-Nov-2026',
    !(await page.isVisible('#dlg-change-date')) && (gwDate2 || '').trim() === '10-Nov-2026', gwDate2);

  // ---------- S10: Alt+F2 Change Period ----------
  await page.keyboard.press('Alt+F2');
  await sleep(200);
  check('S10a Alt+F2 opens the Change Period dialog', await page.isVisible('#dlg-change-period'));
  await shot(page, '09-change-period-dialog');
  await page.fill('#dlg-period-to', '2026-12-31');
  await page.keyboard.press('Enter');
  await sleep(300);
  const gwPeriod = await page.textContent('#gw-period');
  check('S10b Enter applies the new period (01-Apr-2026 to 31-Dec-2026)',
    /01-Apr-2026 to 31-Dec-2026/.test(gwPeriod || ''), gwPeriod);

  // ---------- S15: F3 back to Select Company, Esc on gateway too ----------
  await page.keyboard.press('F3');
  await sleep(200);
  check('S15a F3 returns to Select Company', await page.isVisible('#screen-companies'));
  await page.click('.company-row');
  await sleep(200);
  await page.keyboard.press('Escape');
  await sleep(200);
  check('S15b Esc on the gateway returns to Select Company', await page.isVisible('#screen-companies'));

  // ---------- S13: data updates in place (browser mode: same localStorage key) ----------
  const keysBefore = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('mayaacc-data')));
  await page.click('.company-row');
  await sleep(200);
  await page.keyboard.press('F2');
  await page.fill('#dlg-date-input', '2026-11-11');
  await page.keyboard.press('Enter');
  await sleep(300);
  const keysAfter = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('mayaacc-data')));
  const storedAfter = JSON.parse(await page.evaluate(() => localStorage.getItem('mayaacc-data-v1')));
  check('S13a same storage key updated in place (no new file/key)',
    JSON.stringify(keysBefore) === JSON.stringify(keysAfter), keysAfter.join(','));
  check('S13b stored data reflects the new date', storedAfter.currentDate === '2026-11-11', storedAfter.currentDate);

  // ---------- S14: Open Folder button ----------
  await page.click('#sb-open-folder');
  await sleep(150);
  const sbAfterOpen = await page.textContent('#sb-state');
  check('S14 Open Folder responds (browser mode explains the Windows path)',
    /Documents/.test(sbAfterOpen || ''), sbAfterOpen);

  // ---------- S6: field scrolls into centre view while typing ----------
  await page.setViewportSize({ width: 1280, height: 520 });
  await page.keyboard.press('F3');
  await sleep(200);
  await page.click('#btn-new-company');
  await sleep(200);
  await page.click('.wizard-tab[data-tab="security"]');
  await page.click('#c-pwdsecurity'); // enable security -> password fields appear
  await sleep(150);
  await page.click('#c-pwdconfirm');
  await sleep(250);
  const centered = await page.evaluate(() => {
    const el = document.querySelector('#c-pwdconfirm');
    const r = el.getBoundingClientRect();
    const mid = r.top + r.height / 2;
    return { mid, vh: window.innerHeight, top: r.top, bottom: r.bottom };
  });
  check('S6 focused field scrolls near the centre of the view',
    centered.mid > centered.vh * 0.30 && centered.mid < centered.vh * 0.75,
    JSON.stringify(centered));
  await shot(page, '10-field-centered');
  await page.setViewportSize({ width: 1280, height: 800 });

  // ---------- S16c: company password security stores a salted hash ----------
  await page.click('#c-pwd'); await page.keyboard.type('comp1234');
  await page.click('#c-pwdconfirm'); await page.keyboard.type('comp1234');
  await page.click('.wizard-tab[data-tab="details"]');
  await page.click('#c-name'); await page.keyboard.type('Gupta Stores');
  await page.click('#wizard-next'); // Details -> Tax
  await page.click('#wizard-next'); // Tax -> Accounting
  await page.click('#wizard-next'); // Accounting -> Security
  await page.click('#wizard-next'); // Create Company
  await sleep(400);
  const stored2 = JSON.parse(await page.evaluate(() => localStorage.getItem('mayaacc-data-v1')));
  const gupta = (stored2.companies || []).find((c) => c.name === 'Gupta Stores');
  check('S16c company with security ON stores salted hash (not the password)',
    !!gupta && gupta.passwordSecurity === true &&
    /^[0-9a-f]{64}$/.test(gupta.companyPasswordHash || '') &&
    gupta.companyPasswordHash !== 'comp1234' &&
    (gupta.companySalt || '').length >= 16,
    gupta ? 'hash=' + String(gupta.companyPasswordHash).slice(0, 12) + '…' : 'company missing');
  await shot(page, '11-two-companies');

  // ---------- S12: Last Activity computed from REAL data ----------
  const seedCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const seedPage = await seedCtx.newPage();
  await seedPage.addInitScript(() => {
    const seed = {
      version: '0.1.0',
      settings: { setupDone: true, username: 'sandeep', passwordHash: 'x'.repeat(64), salt: 'y'.repeat(32) },
      companies: [{
        id: 'c_seed', name: 'Seed Traders', mailingName: '', address: '', state: 'Haryana',
        country: 'India', phone: '', mobile: '', email: '', website: '', gstin: '', pan: '',
        taxType: 'Regular', gstDate: '', placeOfSupply: 'Haryana',
        fyStart: '2026-04-01', fyEnd: '2027-03-31', booksFrom: '2026-04-01',
        currency: 'INR', decimals: 2, passwordSecurity: false,
        companyPasswordHash: '', companySalt: '', createdAt: '2026-11-17T00:00:00.000Z',
        transactions: [
          { id: 't1', date: '2026-11-05', type: 'Sales' },
          { id: 't2', date: '2026-11-10', type: 'Payment' },
          { id: 't3', date: '2026-11-08', type: 'Receipt' },
        ],
      }],
      currentCompanyId: null,
      currentDate: '2026-11-17',
      currentPeriod: { from: '2026-04-01', to: '2027-03-31' },
    };
    localStorage.setItem('mayaacc-data-v1', JSON.stringify(seed));
  });
  await seedPage.goto(URL, { waitUntil: 'load' });
  await sleep(300);
  await seedPage.click('.company-row');
  await sleep(300);
  const seedLA = await seedPage.textContent('#gw-last-activity');
  check('S12 Last Activity = latest transaction date (10-Nov-2026, not 05 or 08)',
    (seedLA || '').trim() === '10-Nov-2026', seedLA);
  await seedPage.screenshot({ path: path.join(SHOTS, '12-last-activity-seeded.png') });
  await seedCtx.close();

  // ---------- no page errors ----------
  check('S19 no page errors / console errors during the whole run', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

} catch (err) {
  fail++;
  failures.push('EXCEPTION: ' + err.message);
  console.log('  EXCEPTION  ' + (err && err.stack ? err.stack.split('\n').slice(0, 5).join('\n') : err));
  try { await shot(page, '99-exception'); } catch (e) { /* ignore */ }
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
if (failures.length) console.log('Failures:\n- ' + failures.join('\n- '));
process.exit(fail ? 1 : 0);
