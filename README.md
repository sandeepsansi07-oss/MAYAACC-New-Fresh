# MAYAACC — Fresh Build (from scratch)

**MAYAACC — Smart Accounting Software for Indian Businesses.**
PC-only Windows desktop app, Tally-style keyboard-first accounting.
Built fresh, one module at a time. The old MAYAACC-Original repo keeps
running separately; this is the clean rebuild.

Plan: `~/workspace/goals/mayaacc-pc-desktop-software/files/MAYAACC-Fresh-Build-Plan.md`

## Identity (never changes)

- Name + blue M logo everywhere. Navy blue theme (`#16233f`).
- Layout/behaviour like Tally; colours/theme are MAYAACC's own.
- Text/word/line spacing readable; screens neither big nor tight for no reason.
- English/Hindi option comes in Step 11 (proper Devanagari Hindi).

## Step 0 — Foundation (DONE, verified 2026-11-17)

- Electron skeleton (Windows): `main.js`, `preload.js`, `package.json`
  (electron + electron-builder, NSIS + portable targets).
- First-run-only setup: username + password, salted SHA-256, stored locally.
  After setup the app opens straight to Select Company — no login screen.
- Company creation wizard: 4 REAL tabs (Company Details, Tax & GST,
  Accounting, Security) — clickable, active tab dark navy.
  Address: Enter = new line, Enter twice = next field.
- Data: `Documents\MAYAACC-Data\mayaacc-data.json` — the SAME file updated
  in place on every save. Daily backup in `backups/<YYYY-MM-DD>.json`
  (one per day, 30 days kept).
- Bottom status bar (always visible): Saved/Saving, real path,
  last-saved time, Open Folder button.
- Main screen (Gateway): F2 = Change Date, Alt+F2 = Change Period
  (keyboard only, no button), F3 = Select Company, Esc = back.
  Last Activity computed from real data (latest transaction date).

## Structure (clean + modular — no giant single file)

```
main.js                    Electron main: window + IPC
preload.js                 context bridge (window.mayaaccDesktop)
src/main/data-store.js     pure-Node data layer (load/save in place, backups)
src/renderer/index.html    shell: setup / select-company / wizard / gateway
src/renderer/assets/logo.svg
src/renderer/css/          theme.css, setup.css, wizard.css, gateway.css, dialog.css,
                           masters.css
src/renderer/js/           util.js, crypto.js, store.js, dialogs.js,
                           setup.js, company-select.js, wizard.js,
                           gateway.js, masters.js, app.js
test/data-store.test.mjs   Node test: in-place save, backups, pruning
test/verify-step0.mjs      REAL-BROWSER verification (Playwright + Chromium)
test/verify-step1.mjs      REAL-BROWSER verification for Masters
test/screenshots-step0/    screenshots from the verification run
test/screenshots-step1/    screenshots from the Step 1 verification run
```

## Run / verify

```bash
npm install            # on Windows: installs electron + electron-builder
npm start              # run the desktop app (Electron)
npm test               # Node test for the data layer (in-place save etc.)
npm run verify         # real-browser check: Playwright + Chromium,
                       # real clicks / typing / shortcuts + screenshots
npm run verify:step1   # same, for Masters (Step 1)
npm run dist           # Windows NSIS installer (run on Windows)
```

Browser mode: when opened in a plain browser (no Electron), the renderer
falls back to localStorage under one key — same "one file, updated in
place" behaviour, and the status bar shows the Windows path the file
will have on the user's PC.

## Verification — Step 0 (2026-11-17)

- `npm test`: 9 passed, 0 failed (same inode on re-save, one backup/day, prune to 30).
- `npm run verify`: 47 passed, 0 failed in real Chromium — setup + reload
  (no login), all 4 wizard tabs clickable + dark, typing in every field,
  address double-Enter, field scrolls to centre, company create/open,
  status bar, F2 / Alt+F2 / F3 / Esc, Last Activity from seeded real data
  (10-Nov-2026), in-place update, Open Folder, zero page errors.
  Re-run after the Step 1 changes: still 47 passed, 0 failed.

## Step 1 — Masters (DONE, verified 2026-11-17)

- Masters menu off the Gateway (counts per master). Each master has a
  list screen (search box, scrollable list, "Create" row at the top)
  and a create/edit form screen.
- Groups: Tally's 28 predefined groups seeded (17 primary + 11
  sub-groups). Nature follows the parent group and locks while under
  a parent. Ledgers: Cash + Profit & Loss A/c seeded. Units: Nos seeded.
- One shared picker dialog for parent group / unit / godown — search
  typing, scrolling list, Esc closes without changing anything, arrow
  keys move the picker list (never the screen behind it). The picker
  has a "Create" row: creating a missing master mid-form returns to
  the form with everything typed so far intact and the new record
  already chosen.
- Keyboard: arrows move list/menu, Enter opens or moves to the next
  field, Esc goes back/cancels, Ctrl+A accepts a form (never inside a
  text field, where it still means select-all). Validation: name
  required, duplicate names blocked, Ledger needs a Group, Stock Item
  needs a Unit.
- All masters save into the same mayaacc-data.json (in-place update,
  status bar shows Saved + path + time) and survive reload.

## Verification — Step 1 (2026-11-17)

- `npm run verify:step1`: 65 passed, 0 failed in real Chromium —
  menu keyboard nav, 28 default groups, search filter, arrows + Enter
  to edit, typing lands in every form field (incl. the Group form —
  the old real-EXE bug), picker search/arrows/Enter/mouse/Esc,
  Group create with auto-nature, Ledger create with opening balance,
  Stock Item create with nested Unit + Godown creation from the
  picker (draft preserved), Cost Centre create, picker Esc + form Esc
  cancel without saving, empty/duplicate validation, Esc back through
  menu to Gateway, full persistence across reload, zero page errors.
- One real bug found by the browser run and fixed: Esc on the Masters
  menu landed on Select Company instead of Gateway (two document
  keydown handlers read the same event — the second saw the screen the
  first had just navigated to). Fixed with stopImmediatePropagation +
  a defaultPrevented guard in App's handler; Step 0 re-run still green.

## Next

Step 2 — Vouchers (F4 Contra, F5 Payment, F6 Receipt, F7 Journal,
F8 Sales, F9 Purchase + Delivery Note, Receipt Note, Physical Stock,
Sales Order, Purchase Order, Stock Journal), with the same rule:
build, verify in the real browser, then move on.
