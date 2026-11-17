/**
 * MAYAACC — Step 1: Masters
 * test/verify-step1.mjs — REAL-BROWSER verification (Playwright + Chromium).
 *
 * Serves src/renderer on http://127.0.0.1:8903 and drives it with real
 * mouse clicks, real typing and real shortcuts, exactly as the user would.
 * Screenshots land in test/screenshots-step1/.
 *
 * Run: npm run verify:step1
 */
'use strict';

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', 'src', 'renderer');
const SHOTS = path.join(__dirname, 'screenshots-step1');
const PORT = 8903;
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

const stored = async (page) =>
  JSON.parse(await page.evaluate(() => localStorage.getItem('mayaacc-data-v1')));

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
  // ---------- setup + company (same path as Step 0) ----------
  await page.goto(URL, { waitUntil: 'load' });
  await sleep(300);
  await page.click('#setup-username'); await page.keyboard.type('sandeep');
  await page.click('#setup-password'); await page.keyboard.type('pass1234');
  await page.click('#setup-confirm'); await page.keyboard.type('pass1234');
  await page.click('#setup-submit');
  await sleep(400);
  check('M0a setup done, Select Company shows', await page.isVisible('#screen-companies'));

  await page.click('#btn-new-company');
  await sleep(200);
  await page.click('#c-name'); await page.keyboard.type('Sharma Traders');
  for (let i = 0; i < 4; i++) { await page.click('#wizard-next'); await sleep(150); }
  await sleep(400);
  check('M0b company created', await page.isVisible('#screen-companies'));
  await page.click('.company-row');
  await sleep(300);
  check('M0c gateway opens', await page.isVisible('#screen-gateway'));

  // ---------- M1: Masters menu reachable from Gateway ----------
  check('M1a Masters menu button is enabled (not greyed)', await page.isEnabled('#menu-masters'));
  await page.click('#menu-masters');
  await sleep(250);
  check('M1b Masters menu screen opens', await page.isVisible('#screen-masters'));
  const menuText = await page.textContent('#masters-menu-list');
  check('M1c menu lists all six masters',
    /Groups/.test(menuText) && /Ledgers/.test(menuText) && /Stock Items/.test(menuText) &&
    /Units/.test(menuText) && /Godowns/.test(menuText) && /Cost Centres/.test(menuText), menuText);
  await shot(page, '01-masters-menu');

  // ---------- M2: menu keyboard navigation ----------
  await page.keyboard.press('ArrowDown');
  await sleep(120);
  let selMenu = await page.evaluate(() => {
    const el = document.querySelector('.masters-menu-item.sel');
    return el ? el.dataset.type : '';
  });
  check('M2a ArrowDown on menu moves selection to Ledgers', selMenu === 'ledgers', selMenu);
  await page.keyboard.press('ArrowUp');
  await sleep(120);
  selMenu = await page.evaluate(() => {
    const el = document.querySelector('.masters-menu-item.sel');
    return el ? el.dataset.type : '';
  });
  check('M2b ArrowUp moves selection back to Groups', selMenu === 'groups', selMenu);
  await page.keyboard.press('Enter');
  await sleep(250);
  check('M2c Enter on menu opens the Groups list', await page.isVisible('#screen-master-list'));

  // ---------- M3: Groups list — Tally's 28 default groups ----------
  const countText = await page.textContent('#master-list-count');
  check('M3a Groups list shows 28 default records', /28 records/.test(countText || ''), countText);
  const listText = await page.textContent('#master-list');
  check('M3b list contains Capital Account, Bank Accounts, Cash-in-Hand',
    /Capital Account/.test(listText) && /Bank Accounts/.test(listText) && /Cash-in-Hand/.test(listText), listText.slice(0, 200));
  await shot(page, '02-groups-list');

  // ---------- M4: search typing filters the list ----------
  await page.click('#master-list-search');
  await page.keyboard.type('cash');
  await sleep(200);
  const filteredText = await page.textContent('#master-list');
  check('M4a typing "cash" filters to Cash-in-Hand only',
    /Cash-in-Hand/.test(filteredText) && !/Capital Account/.test(filteredText), filteredText.slice(0, 200));
  await page.click('#master-list-search');
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await sleep(200);
  const clearedText = await page.textContent('#master-list');
  check('M4b clearing the search shows all groups again', /Capital Account/.test(clearedText || ''));

  // ---------- M5: arrows move the list, Enter opens edit (keyboard still works after mouse click) ----------
  await page.keyboard.press('ArrowDown'); // sel: Create -> Bank Accounts
  await sleep(120);
  let selRow = await page.evaluate(() => {
    const el = document.querySelector('#master-list .master-row.sel');
    return el ? el.dataset.id : '';
  });
  const firstGroup = (await stored(page)).companies[0].masters.groups
    .slice().sort((a, b) => a.name.localeCompare(b.name))[0];
  check('M5a ArrowDown moves selection to the first group (Bank Accounts)',
    selRow === firstGroup.id, 'sel=' + selRow + ' expected=' + firstGroup.id);
  await page.keyboard.press('Enter');
  await sleep(250);
  check('M5b Enter opens the Group edit form', await page.isVisible('#screen-master-form'));
  const formTitle = await page.textContent('#master-form-title');
  check('M5c edit form is for Bank Accounts', /Bank Accounts/.test(formTitle || ''), formTitle);
  const underText = await page.textContent('#master-form-fields [data-field="parentId"] .pf-name');
  check('M5d Under shows the parent group (Current Assets)', (underText || '').trim() === 'Current Assets', underText);
  const natureState = await page.evaluate(() => {
    const el = document.querySelector('#master-form-fields [data-field="nature"]');
    return { disabled: el.disabled, value: el.value };
  });
  check('M5e Nature follows the parent (Assets) and is locked while under a parent',
    natureState.disabled === true && natureState.value === 'Assets', JSON.stringify(natureState));
  await shot(page, '03-group-edit');
  await page.keyboard.press('Escape');
  await sleep(250);
  check('M5f Esc on the form returns to the list without saving',
    await page.isVisible('#screen-master-list'));

  // ---------- M6: create a Group by typing + Group picker ----------
  await page.click('#master-list .master-row.create-row');
  await sleep(250);
  check('M6a clicking Create opens the Create Group form', await page.isVisible('#screen-master-form'));
  await page.click('#master-form-fields [data-field="name"]');
  await page.keyboard.type('Office Expenses');
  const typedName = await page.inputValue('#master-form-fields [data-field="name"]');
  check('M6b typing lands in the Group Name field (the old real-EXE bug)', typedName === 'Office Expenses', typedName);
  // Enter moves to the next field (Under picker button).
  await page.keyboard.press('Enter');
  await sleep(150);
  let focused = await page.evaluate(() => document.activeElement && document.activeElement.dataset.field);
  check('M6c Enter moves focus to the next field (Under)', focused === 'parentId', focused);
  // Enter on the picker button opens the picker.
  await page.keyboard.press('Enter');
  await sleep(200);
  check('M6d picker dialog opens', await page.isVisible('#dlg-picker'));
  await page.click('#dlg-picker-search');
  await page.keyboard.type('indirect');
  await sleep(200);
  const pickerText = await page.textContent('#dlg-picker-list');
  check('M6e picker search filters to Indirect groups',
    /Indirect Expenses/.test(pickerText) && /Indirect Incomes/.test(pickerText) &&
    !/Capital Account/.test(pickerText), pickerText.slice(0, 200));
  await page.keyboard.press('ArrowDown'); // -> Indirect Incomes
  await page.keyboard.press('ArrowUp');   // -> back to Indirect Expenses
  await sleep(120);
  await page.keyboard.press('Enter'); // select Indirect Expenses
  await sleep(200);
  check('M6f picker closes after Enter-select', !(await page.isVisible('#dlg-picker')));
  const underAfter = await page.textContent('#master-form-fields [data-field="parentId"] .pf-name');
  check('M6g Under now shows Indirect Expenses', (underAfter || '').trim() === 'Indirect Expenses', underAfter);
  const natureAfter = await page.evaluate(() => {
    const el = document.querySelector('#master-form-fields [data-field="nature"]');
    return { disabled: el.disabled, value: el.value };
  });
  check('M6h Nature auto-set to Expenses and locked', natureAfter.disabled === true && natureAfter.value === 'Expenses', JSON.stringify(natureAfter));
  // Ctrl+A accepts the form (focus is on the picker button, not a text field).
  await page.keyboard.press('Control+A');
  await sleep(400);
  check('M6i Ctrl+A saves and returns to the list', await page.isVisible('#screen-master-list'));
  const listAfterGroup = await page.textContent('#master-list');
  check('M6j new Group "Office Expenses" appears in the list', /Office Expenses/.test(listAfterGroup || ''));
  const savedGroup = (await stored(page)).companies[0].masters.groups
    .find((g) => g.name === 'Office Expenses');
  check('M6k saved group has parent Indirect Expenses + nature Expenses',
    !!savedGroup && savedGroup.nature === 'Expenses' &&
    groupNameIs(savedGroup.parentId, 'Indirect Expenses', await stored(page)), JSON.stringify(savedGroup));
  const sbState = await page.textContent('#sb-state');
  check('M6l status bar shows Saved after the save', /Saved/.test(sbState || ''), sbState);
  await shot(page, '04-group-created');

  // ---------- M7: Ledger create with Group picker (mouse) ----------
  await page.keyboard.press('Escape'); // list -> menu
  await sleep(200);
  await page.click('.masters-menu-item[data-type="ledgers"]');
  await sleep(250);
  const ledgerCount = await page.textContent('#master-list-count');
  check('M7a Ledgers list shows the 2 default ledgers (Cash, Profit & Loss A/c)',
    /2 records/.test(ledgerCount || ''), ledgerCount);
  await page.click('#master-list .master-row.create-row');
  await sleep(250);
  await page.click('#master-form-fields [data-field="name"]');
  await page.keyboard.type('HDFC Bank');
  check('M7b typing lands in the Ledger Name field',
    (await page.inputValue('#master-form-fields [data-field="name"]')) === 'HDFC Bank');
  await page.click('#master-form-fields [data-field="groupId"]');
  await sleep(200);
  check('M7c Group picker opens from the Ledger form', await page.isVisible('#dlg-picker'));
  await page.click('#dlg-picker-search');
  await page.keyboard.type('bank');
  await sleep(200);
  await page.click('.picker-row:has-text("Bank Accounts")');
  await sleep(200);
  const ledgerGroup = await page.textContent('#master-form-fields [data-field="groupId"] .pf-name');
  check('M7d mouse click in the picker selects Bank Accounts', (ledgerGroup || '').trim() === 'Bank Accounts', ledgerGroup);
  await page.click('#master-form-fields [data-field="openingBalance"]');
  await page.keyboard.type('50000');
  await page.click('#master-form-save');
  await sleep(400);
  const ledgerListText = await page.textContent('#master-list');
  check('M7e new Ledger appears with group + opening balance',
    /HDFC Bank/.test(ledgerListText) && /Bank Accounts/.test(ledgerListText) &&
    /50,000\.00 Dr/.test(ledgerListText), ledgerListText.slice(0, 300));
  await shot(page, '05-ledger-created');

  // ---------- M8: Stock Item + create Unit/Godown from inside the picker ----------
  await page.keyboard.press('Escape');
  await sleep(200);
  await page.click('.masters-menu-item[data-type="stockItems"]');
  await sleep(250);
  await page.click('#master-list .master-row.create-row');
  await sleep(250);
  await page.click('#master-form-fields [data-field="name"]');
  await page.keyboard.type('Basmati Rice');
  check('M8a typing lands in the Stock Item Name field',
    (await page.inputValue('#master-form-fields [data-field="name"]')) === 'Basmati Rice');
  await page.keyboard.press('Enter'); // -> Unit picker button
  await sleep(120);
  await page.keyboard.press('Enter'); // opens Unit picker
  await sleep(200);
  check('M8b Unit picker opens', await page.isVisible('#dlg-picker'));
  await page.click('#dlg-picker-list .picker-row.create-row');
  await sleep(250);
  check('M8c picker Create opens the Create Unit form (not a dead end)',
    await page.isVisible('#screen-master-form') &&
    /Create Unit/.test(await page.textContent('#master-form-title') || ''));
  await page.click('#master-form-fields [data-field="name"]');
  await page.keyboard.type('Kilogram');
  await page.keyboard.press('Enter'); // -> Symbol field
  await sleep(120);
  await page.keyboard.type('Kg');
  check('M8d typing lands in Unit Symbol', (await page.inputValue('#master-form-fields [data-field="symbol"]')) === 'Kg');
  await page.click('#master-form-save');
  await sleep(400);
  check('M8e saving the Unit returns to the Stock Item form',
    await page.isVisible('#screen-master-form') &&
    /Stock Item/.test(await page.textContent('#master-form-title') || ''));
  const unitAfter = await page.textContent('#master-form-fields [data-field="unitId"] .pf-name');
  check('M8f the new Unit is already chosen in the Stock Item form',
    /Kilogram \(Kg\)/.test(unitAfter || ''), unitAfter);
  const nameKept = await page.inputValue('#master-form-fields [data-field="name"]');
  check('M8g the typed Stock Item name survived the detour', nameKept === 'Basmati Rice', nameKept);
  await page.click('#master-form-fields [data-field="openingStock"]');
  await page.keyboard.type('100');
  await page.click('#master-form-fields [data-field="openingRate"]');
  await page.keyboard.type('85');
  await page.click('#master-form-fields [data-field="godownId"]');
  await sleep(200);
  await page.click('#dlg-picker-list .picker-row.create-row');
  await sleep(250);
  check('M8h picker Create opens the Create Godown form',
    /Create Godown/.test(await page.textContent('#master-form-title') || ''));
  await page.click('#master-form-fields [data-field="name"]');
  await page.keyboard.type('Main Godown');
  await page.keyboard.press('Enter');
  await sleep(120);
  await page.keyboard.type('Panipat');
  await page.click('#master-form-save');
  await sleep(400);
  const godownAfter = await page.textContent('#master-form-fields [data-field="godownId"] .pf-name');
  check('M8i the new Godown is already chosen in the Stock Item form',
    (godownAfter || '').trim() === 'Main Godown', godownAfter);
  await page.click('#master-form-save');
  await sleep(400);
  const itemListText = await page.textContent('#master-list');
  check('M8j Stock Item appears with unit + opening stock/rate',
    /Basmati Rice/.test(itemListText) && /Kg/.test(itemListText) &&
    /100 @/.test(itemListText) && /85\.00/.test(itemListText), itemListText.slice(0, 300));
  await shot(page, '06-stock-item-created');

  // ---------- M9: Units, Godowns, Cost Centres lists + create Cost Centre ----------
  await page.keyboard.press('Escape');
  await sleep(200);
  await page.click('.masters-menu-item[data-type="units"]');
  await sleep(250);
  const unitsText = await page.textContent('#master-list');
  check('M9a Units list shows Nos + Kilogram', /Nos/.test(unitsText) && /Kilogram/.test(unitsText), unitsText.slice(0, 200));
  await page.keyboard.press('Escape');
  await sleep(200);
  await page.click('.masters-menu-item[data-type="godowns"]');
  await sleep(250);
  const godownsText = await page.textContent('#master-list');
  check('M9b Godowns list shows Main Godown', /Main Godown/.test(godownsText || ''));
  await page.keyboard.press('Escape');
  await sleep(200);
  await page.click('.masters-menu-item[data-type="costCentres"]');
  await sleep(250);
  await page.click('#master-list .master-row.create-row');
  await sleep(250);
  await page.click('#master-form-fields [data-field="name"]');
  await page.keyboard.type('Head Office');
  await page.click('#master-form-save');
  await sleep(400);
  const ccText = await page.textContent('#master-list');
  check('M9c Cost Centre "Head Office" created and listed', /Head Office/.test(ccText || ''));
  await shot(page, '07-cost-centre-created');

  // ---------- M10: picker Esc closes without changing anything ----------
  await page.keyboard.press('Escape');
  await sleep(200);
  await page.click('.masters-menu-item[data-type="ledgers"]');
  await sleep(250);
  await page.click('#master-list .master-row.create-row');
  await sleep(250);
  await page.click('#master-form-fields [data-field="name"]');
  await page.keyboard.type('Temp Ledger');
  await page.click('#master-form-fields [data-field="groupId"]');
  await sleep(200);
  check('M10a picker opens', await page.isVisible('#dlg-picker'));
  await page.keyboard.press('Escape');
  await sleep(200);
  check('M10b Esc closes the picker', !(await page.isVisible('#dlg-picker')));
  const groupUnchanged = await page.textContent('#master-form-fields [data-field="groupId"] .pf-name');
  check('M10c Esc leaves the field unchanged (still unselected)',
    /Select/.test(groupUnchanged || ''), groupUnchanged);
  check('M10d the form is still open after picker Esc', await page.isVisible('#screen-master-form'));
  await page.keyboard.press('Escape'); // cancel the form
  await sleep(250);
  const ledgerListAfterCancel = await page.textContent('#master-list');
  check('M10e Esc on the form cancels — "Temp Ledger" was NOT saved',
    !/Temp Ledger/.test(ledgerListAfterCancel || ''));

  // ---------- M11: validation — empty name + duplicate name ----------
  await page.click('#master-list .master-row.create-row');
  await sleep(250);
  await page.click('#master-form-save');
  await sleep(200);
  const errEmpty = await page.textContent('#master-form-error');
  check('M11a empty Name blocks save with an error',
    /required/i.test(errEmpty || '') && await page.isVisible('#screen-master-form'), errEmpty);
  await page.click('#master-form-fields [data-field="name"]');
  await page.keyboard.type('Cash');
  await page.click('#master-form-fields [data-field="groupId"]');
  await sleep(200);
  await page.click('.picker-row:has-text("Cash-in-Hand")');
  await sleep(200);
  await page.click('#master-form-save');
  await sleep(300);
  const errDup = await page.textContent('#master-form-error');
  check('M11b duplicate Ledger name blocks save with an error',
    /already exists/i.test(errDup || '') && await page.isVisible('#screen-master-form'), errDup);
  await page.keyboard.press('Escape');
  await sleep(200);

  // ---------- M12: Esc back through menu to Gateway ----------
  check('M12a back on the Ledgers list', await page.isVisible('#screen-master-list'));
  await page.keyboard.press('Escape');
  await sleep(200);
  check('M12b Esc on the list returns to the Masters menu', await page.isVisible('#screen-masters'));
  await page.keyboard.press('Escape');
  await sleep(200);
  check('M12c Esc on the menu returns to the Gateway', await page.isVisible('#screen-gateway'));

  // ---------- M13: persistence across reload ----------
  await page.reload({ waitUntil: 'load' });
  await sleep(300);
  check('M13a reload goes straight to Select Company (no setup)', await page.isVisible('#screen-companies'));
  await page.click('.company-row');
  await sleep(300);
  await page.click('#menu-masters');
  await sleep(250);
  await page.click('.masters-menu-item[data-type="groups"]');
  await sleep(250);
  const groupsAfterReload = await page.textContent('#master-list');
  check('M13b Group "Office Expenses" survives reload', /Office Expenses/.test(groupsAfterReload || ''));
  await page.keyboard.press('Escape');
  await sleep(200);
  await page.click('.masters-menu-item[data-type="ledgers"]');
  await sleep(250);
  const ledgersAfterReload = await page.textContent('#master-list');
  check('M13c Ledger "HDFC Bank" survives reload', /HDFC Bank/.test(ledgersAfterReload || ''));
  await page.keyboard.press('Escape');
  await sleep(200);
  await page.click('.masters-menu-item[data-type="stockItems"]');
  await sleep(250);
  const itemsAfterReload = await page.textContent('#master-list');
  check('M13d Stock Item "Basmati Rice" survives reload', /Basmati Rice/.test(itemsAfterReload || ''));
  const finalStored = await stored(page);
  const m = finalStored.companies[0].masters;
  check('M13e stored data has all masters (29 groups, 3 ledgers, 1 item, 2 units, 1 godown, 1 cost centre)',
    m.groups.length === 29 && m.ledgers.length === 3 && m.stockItems.length === 1 &&
    m.units.length === 2 && m.godowns.length === 1 && m.costCentres.length === 1,
    JSON.stringify({ g: m.groups.length, l: m.ledgers.length, i: m.stockItems.length, u: m.units.length, d: m.godowns.length, c: m.costCentres.length }));
  await shot(page, '08-after-reload');

  // ---------- no page errors ----------
  check('M14 no page errors / console errors during the whole run', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

} catch (err) {
  fail++;
  failures.push('EXCEPTION: ' + err.message);
  console.log('  EXCEPTION  ' + (err && err.stack ? err.stack.split('\n').slice(0, 5).join('\n') : err));
  try { await shot(page, '99-exception'); } catch (e) { /* ignore */ }
} finally {
  await browser.close();
  server.close();
}

function groupNameIs(id, name, data) {
  const g = (data.companies[0].masters.groups || []).find((x) => x.id === id);
  return !!g && g.name === name;
}

console.log(`\n${pass} passed, ${fail} failed`);
if (failures.length) console.log('Failures:\n- ' + failures.join('\n- '));
process.exit(fail ? 1 : 0);
