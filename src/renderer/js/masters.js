/**
 * MAYAACC — Step 1: Masters
 * src/renderer/js/masters.js — Groups, Ledgers, Stock Items, Units,
 * Godowns, Cost Centres.
 *
 * Tally-style: a Masters menu off the Gateway; each master has a list
 * screen (search box, scrollable list, "Create" row at the top) and a
 * create/edit form screen. One shared picker dialog (see Dialogs)
 * chooses a parent group / unit / godown — with a "Create" row at the
 * top of the picker, so a missing master can be created on the spot
 * and the form you came from is restored with your typed values.
 *
 * Keyboard-first (same rules as everywhere else):
 *   Arrows move the list/menu selection, Enter opens or saves,
 *   Esc goes back (picker: closes without changing anything),
 *   Ctrl+A accepts a form. Typing in a search box filters the list.
 *   Arrow keys inside a picker move the PICKER list, never the
 *   screen behind it.
 */
'use strict';

const Masters = (() => {
  /* ================= data ================= */

  const META = {
    groups:      { title: 'Groups',       singular: 'Group',       prefix: 'g' },
    ledgers:     { title: 'Ledgers',      singular: 'Ledger',      prefix: 'l' },
    stockItems:  { title: 'Stock Items',  singular: 'Stock Item',  prefix: 'i' },
    units:       { title: 'Units',        singular: 'Unit',        prefix: 'u' },
    godowns:     { title: 'Godowns',      singular: 'Godown',      prefix: 'd' },
    costCentres: { title: 'Cost Centres', singular: 'Cost Centre', prefix: 'c' },
  };

  const MENU = ['groups', 'ledgers', 'stockItems', 'units', 'godowns', 'costCentres'];

  // Tally's predefined groups: 17 primary + 11 sub-groups.
  const PRIMARY_GROUPS = [
    ['Capital Account', 'Liabilities'],
    ['Current Assets', 'Assets'],
    ['Current Liabilities', 'Liabilities'],
    ['Direct Expenses', 'Expenses'],
    ['Direct Incomes', 'Income'],
    ['Fixed Assets', 'Assets'],
    ['Indirect Expenses', 'Expenses'],
    ['Indirect Incomes', 'Income'],
    ['Investments', 'Assets'],
    ['Loans (Liability)', 'Liabilities'],
    ['Misc. Expenses (Asset)', 'Assets'],
    ['Purchase Accounts', 'Expenses'],
    ['Sales Accounts', 'Income'],
    ['Stock-in-Hand', 'Assets'],
    ['Sundry Creditors', 'Liabilities'],
    ['Sundry Debtors', 'Assets'],
    ['Suspense A/c', 'Assets'],
  ];
  const SUB_GROUPS = [
    ['Bank Accounts', 'Current Assets'],
    ['Bank OCC A/c', 'Loans (Liability)'],
    ['Bank OD A/c', 'Loans (Liability)'],
    ['Branch / Divisions', 'Current Assets'],
    ['Cash-in-Hand', 'Current Assets'],
    ['Deposits (Asset)', 'Current Assets'],
    ['Duties & Taxes', 'Current Liabilities'],
    ['Provisions', 'Current Liabilities'],
    ['Reserves & Surplus', 'Capital Account'],
    ['Secured Loans', 'Loans (Liability)'],
    ['Unsecured Loans', 'Loans (Liability)'],
  ];

  function defaultMasters() {
    const groups = [];
    const byName = {};
    for (const [name, nature] of PRIMARY_GROUPS) {
      const g = { id: uid('g'), name, parentId: '', nature, createdAt: new Date().toISOString() };
      groups.push(g);
      byName[name] = g;
    }
    for (const [name, parentName] of SUB_GROUPS) {
      const parent = byName[parentName];
      const g = {
        id: uid('g'), name, parentId: parent ? parent.id : '',
        nature: parent ? parent.nature : 'Assets',
        createdAt: new Date().toISOString(),
      };
      groups.push(g);
      byName[name] = g;
    }
    const cashGroup = byName['Cash-in-Hand'];
    const capital = byName['Capital Account'];
    return {
      groups,
      ledgers: [
        { id: uid('l'), name: 'Cash', groupId: cashGroup ? cashGroup.id : '',
          openingBalance: 0, openingType: 'Dr', createdAt: new Date().toISOString() },
        { id: uid('l'), name: 'Profit & Loss A/c', groupId: capital ? capital.id : '',
          openingBalance: 0, openingType: 'Dr', createdAt: new Date().toISOString() },
      ],
      stockItems: [],
      units: [
        { id: uid('u'), name: 'Nos', symbol: 'Nos', createdAt: new Date().toISOString() },
      ],
      godowns: [],
      costCentres: [],
    };
  }

  /** Seed defaults for companies made in Step 0 (which have no masters yet). */
  function ensureDefaults(company) {
    if (!company) return null;
    if (!company.masters) {
      company.masters = defaultMasters();
      return company.masters;
    }
    for (const key of Object.keys(META)) {
      if (!Array.isArray(company.masters[key])) company.masters[key] = [];
    }
    return company.masters;
  }

  function masters() {
    return ensureDefaults(Store.currentCompany());
  }

  function records(type) {
    const m = masters();
    return m ? (m[type] || []) : [];
  }

  function findRecord(type, id) {
    return records(type).find((r) => r.id === id) || null;
  }

  function groupName(id) {
    if (!id) return '';
    const g = findRecord('groups', id);
    return g ? g.name : '';
  }

  function groupNature(id) {
    const g = findRecord('groups', id);
    return g ? g.nature : '';
  }

  function unitSymbol(id) {
    const u = findRecord('units', id);
    return u ? u.symbol : '';
  }

  function fmtMoney(n) {
    const v = Number(n) || 0;
    return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /* ================= field definitions ================= */

  function fieldDefs(type) {
    switch (type) {
      case 'groups': return [
        { key: 'name', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. Office Expenses' },
        { key: 'parentId', label: 'Under', kind: 'picker', pickerType: 'groups', placeholder: 'Primary' },
        { key: 'nature', label: 'Nature', kind: 'select', options: ['Assets', 'Liabilities', 'Income', 'Expenses'] },
      ];
      case 'ledgers': return [
        { key: 'name', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. HDFC Bank' },
        { key: 'groupId', label: 'Under (Group)', kind: 'picker', pickerType: 'groups', required: true },
        { key: 'openingBalance', label: 'Opening Balance', kind: 'number', placeholder: '0' },
        { key: 'openingType', label: 'Dr / Cr', kind: 'select', options: ['Dr', 'Cr'] },
      ];
      case 'stockItems': return [
        { key: 'name', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. Basmati Rice' },
        { key: 'unitId', label: 'Unit', kind: 'picker', pickerType: 'units', required: true },
        { key: 'openingStock', label: 'Opening Stock', kind: 'number', placeholder: '0' },
        { key: 'openingRate', label: 'Opening Rate (₹)', kind: 'number', placeholder: '0' },
        { key: 'godownId', label: 'Godown', kind: 'picker', pickerType: 'godowns', placeholder: 'Select a godown (optional)' },
      ];
      case 'units': return [
        { key: 'name', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. Kilogram' },
        { key: 'symbol', label: 'Symbol', kind: 'text', required: true, placeholder: 'e.g. Kg' },
      ];
      case 'godowns': return [
        { key: 'name', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. Main Godown' },
        { key: 'location', label: 'Location', kind: 'text', placeholder: 'e.g. Panipat' },
      ];
      case 'costCentres': return [
        { key: 'name', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. Head Office' },
        { key: 'parentId', label: 'Under', kind: 'picker', pickerType: 'costCentres', placeholder: 'Primary' },
      ];
      default: return [];
    }
  }

  function defaultValues(type) {
    switch (type) {
      case 'groups': return { name: '', parentId: '', nature: 'Assets' };
      case 'ledgers': return { name: '', groupId: '', openingBalance: 0, openingType: 'Dr' };
      case 'stockItems': return { name: '', unitId: '', openingStock: 0, openingRate: 0, godownId: '' };
      case 'units': return { name: '', symbol: '' };
      case 'godowns': return { name: '', location: '' };
      case 'costCentres': return { name: '', parentId: '' };
      default: return {};
    }
  }

  /** Display text for a picker field's current value. */
  function pickerDisplay(def, value) {
    if (!value) return def.placeholder || 'Select…';
    switch (def.pickerType) {
      case 'groups': return groupName(value) || 'Select…';
      case 'units': {
        const u = findRecord('units', value);
        return u ? u.name + ' (' + u.symbol + ')' : 'Select…';
      }
      case 'godowns': {
        const g = findRecord('godowns', value);
        return g ? g.name : 'Select…';
      }
      case 'costCentres': {
        const c = findRecord('costCentres', value);
        return c ? c.name : 'Select…';
      }
      default: return 'Select…';
    }
  }

  function subText(type, rec) {
    switch (type) {
      case 'groups':
        return (rec.parentId ? groupName(rec.parentId) : 'Primary') + ' · ' + rec.nature;
      case 'ledgers':
        return groupName(rec.groupId) + ' · Op. Bal. ' +
          fmtMoney(rec.openingBalance) + ' ' + (rec.openingType || 'Dr');
      case 'stockItems':
        return (unitSymbol(rec.unitId) || '—') + ' · Op. Stock: ' +
          (Number(rec.openingStock) || 0) + ' @ ' + fmtMoney(rec.openingRate);
      case 'units':
        return 'Symbol: ' + rec.symbol;
      case 'godowns':
        return rec.location || 'No location';
      case 'costCentres': {
        const parent = findRecord('costCentres', rec.parentId);
        return parent ? parent.name : 'Primary';
      }
      default:
        return '';
    }
  }

  /* ================= Masters menu ================= */

  let menuSel = 0;

  function showMenu() {
    ensureDefaults(Store.currentCompany());
    Store.save();
    menuSel = 0;
    renderMenu();
    App.showScreen('screen-masters');
  }

  function renderMenu() {
    const listEl = $('#masters-menu-list');
    listEl.innerHTML = '';
    MENU.forEach((type, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'masters-menu-item' + (idx === menuSel ? ' sel' : '');
      btn.dataset.type = type;
      const label = document.createElement('span');
      label.textContent = META[type].title;
      const count = document.createElement('span');
      count.className = 'menu-count';
      count.textContent = String(records(type).length);
      btn.appendChild(label);
      btn.appendChild(count);
      btn.addEventListener('click', () => { menuSel = idx; openList(type); });
      btn.addEventListener('mouseenter', () => { menuSel = idx; paintMenuSel(); });
      listEl.appendChild(btn);
    });
    const c = Store.currentCompany();
    $('#masters-company').textContent = c ? c.name : '';
  }

  function paintMenuSel() {
    $$('.masters-menu-item').forEach((el, idx) => el.classList.toggle('sel', idx === menuSel));
  }

  function menuMove(d) {
    menuSel = Math.max(0, Math.min(MENU.length - 1, menuSel + d));
    paintMenuSel();
    const el = $$('.masters-menu-item')[menuSel];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  /* ================= list screen ================= */

  let listCtx = null; // { type, filter, sel, rows:[{id}] }

  function openList(type, selectId) {
    ensureDefaults(Store.currentCompany());
    listCtx = { type, filter: '', sel: 0, rows: [] };
    $('#master-list-title').textContent = META[type].title;
    $('#master-list-sub').textContent =
      'Click a row to edit it, or Create a new one. Type in the search box to filter.';
    $('#master-list-search').value = '';
    renderList();
    if (selectId) {
      const idx = listCtx.rows.findIndex((r) => r.id === selectId);
      if (idx >= 0) { listCtx.sel = idx; paintListSel(); }
    }
    App.showScreen('screen-master-list');
    setTimeout(() => $('#master-list-search').focus(), 0);
  }

  function filteredRows() {
    const all = records(listCtx.type).slice()
      .sort((a, b) => a.name.localeCompare(b.name));
    const q = (listCtx.filter || '').trim().toLowerCase();
    const shown = q ? all.filter((r) => r.name.toLowerCase().includes(q)) : all;
    return [{ id: '__create__' }].concat(shown);
  }

  function renderList() {
    listCtx.rows = filteredRows();
    if (listCtx.sel > listCtx.rows.length - 1) listCtx.sel = Math.max(0, listCtx.rows.length - 1);
    const listEl = $('#master-list');
    listEl.innerHTML = '';
    for (const row of listCtx.rows) {
      const btn = document.createElement('button');
      btn.type = 'button';
      if (row.id === '__create__') {
        btn.className = 'master-row create-row';
        btn.dataset.id = '__create__';
        const name = document.createElement('span');
        name.className = 'mr-name';
        name.textContent = '+ Create';
        const sub = document.createElement('span');
        sub.className = 'mr-sub';
        sub.textContent = 'Create a new ' + META[listCtx.type].singular;
        btn.appendChild(name);
        btn.appendChild(sub);
      } else {
        btn.className = 'master-row';
        btn.dataset.id = row.id;
        const name = document.createElement('span');
        name.className = 'mr-name';
        name.textContent = row.name;
        const sub = document.createElement('span');
        sub.className = 'mr-sub';
        sub.textContent = subText(listCtx.type, row);
        btn.appendChild(name);
        btn.appendChild(sub);
      }
      btn.addEventListener('click', () => openRow(row.id));
      btn.addEventListener('mouseenter', () => {
        const idx = listCtx.rows.findIndex((r) => r.id === row.id);
        if (idx >= 0) { listCtx.sel = idx; paintListSel(); }
      });
      listEl.appendChild(btn);
    }
    $('#master-list-count').textContent =
      records(listCtx.type).length + ' record' +
      (records(listCtx.type).length === 1 ? '' : 's') +
      (listCtx.filter ? ' · filtered' : '');
    paintListSel();
  }

  function paintListSel() {
    $$('#master-list .master-row').forEach((el, idx) => {
      el.classList.toggle('sel', idx === listCtx.sel);
    });
  }

  function listMove(d) {
    if (!listCtx || listCtx.rows.length === 0) return;
    listCtx.sel = Math.max(0, Math.min(listCtx.rows.length - 1, listCtx.sel + d));
    paintListSel();
    const el = $$('#master-list .master-row')[listCtx.sel];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  function openRow(id) {
    if (id === '__create__') {
      openForm(listCtx.type, {});
    } else {
      openForm(listCtx.type, { id });
    }
  }

  function openSelectedRow() {
    if (!listCtx || listCtx.rows.length === 0) return;
    openRow(listCtx.rows[listCtx.sel].id);
  }

  /* ================= form screen ================= */

  let formCtx = null; // { type, id, returnTo }

  function openForm(type, opts) {
    opts = opts || {};
    formCtx = { type, id: opts.id || null, returnTo: opts.returnTo || null };
    const meta = META[type];
    const rec = formCtx.id ? findRecord(type, formCtx.id) : null;
    let values = rec ? recordToValues(type, rec) : defaultValues(type);
    if (opts.draft) values = Object.assign({}, values, opts.draft);
    if (opts.preselect) values[opts.preselect.field] = opts.preselect.id;

    $('#master-form-title').textContent =
      (formCtx.id ? 'Edit ' : 'Create ') + meta.singular +
      (rec ? ' — ' + rec.name : '');
    $('#master-form-error').textContent = '';
    renderFormFields(type, values);
    App.showScreen('screen-master-form');
    const first = $('#master-form-fields input, #master-form-fields select, #master-form-fields .picker-field');
    if (first) setTimeout(() => first.focus(), 0);
  }

  function recordToValues(type, rec) {
    const v = {};
    for (const def of fieldDefs(type)) {
      v[def.key] = rec[def.key] !== undefined && rec[def.key] !== null ? rec[def.key] : '';
    }
    return v;
  }

  function renderFormFields(type, values) {
    const wrap = $('#master-form-fields');
    wrap.innerHTML = '';
    for (const def of fieldDefs(type)) {
      const fieldDiv = document.createElement('div');
      fieldDiv.className = 'field';
      const label = document.createElement('label');
      label.textContent = def.label + (def.required ? ' ' : '');
      if (def.required) {
        const req = document.createElement('span');
        req.className = 'req';
        req.textContent = '*';
        label.appendChild(req);
      }
      fieldDiv.appendChild(label);

      if (def.kind === 'text' || def.kind === 'number') {
        const input = document.createElement('input');
        input.type = def.kind === 'number' ? 'number' : 'text';
        if (def.kind === 'number') input.step = 'any';
        input.dataset.field = def.key;
        input.value = values[def.key] !== undefined && values[def.key] !== '' ? values[def.key] : '';
        input.placeholder = def.placeholder || '';
        input.autocomplete = 'off';
        fieldDiv.appendChild(input);
      } else if (def.kind === 'select') {
        const sel = document.createElement('select');
        sel.dataset.field = def.key;
        for (const opt of def.options) {
          const o = document.createElement('option');
          o.value = opt;
          o.textContent = opt;
          sel.appendChild(o);
        }
        sel.value = values[def.key] || def.options[0];
        fieldDiv.appendChild(sel);
      } else if (def.kind === 'picker') {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'picker-field';
        btn.dataset.field = def.key;
        btn.dataset.value = values[def.key] || '';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'pf-name';
        nameSpan.textContent = pickerDisplay(def, values[def.key]);
        const hint = document.createElement('span');
        hint.className = 'pf-hint';
        hint.textContent = '▾ Change';
        btn.appendChild(nameSpan);
        btn.appendChild(hint);
        btn.addEventListener('click', () => openPickerFor(def, btn));
        fieldDiv.appendChild(btn);
      }
      wrap.appendChild(fieldDiv);
    }
    syncGroupNature();
  }

  /** Group nature follows the parent group; editable only for Primary groups. */
  function syncGroupNature() {
    if (!formCtx || formCtx.type !== 'groups') return;
    const parentBtn = $('#master-form-fields [data-field="parentId"]');
    const natureSel = $('#master-form-fields [data-field="nature"]');
    if (!parentBtn || !natureSel) return;
    const parentId = parentBtn.dataset.value || '';
    if (parentId) {
      natureSel.value = groupNature(parentId) || 'Assets';
      natureSel.disabled = true;
    } else {
      natureSel.disabled = false;
    }
  }

  function readFormValues() {
    const values = {};
    for (const def of fieldDefs(formCtx.type)) {
      const el = $('#master-form-fields [data-field="' + def.key + '"]');
      if (!el) continue;
      if (def.kind === 'picker') {
        values[def.key] = el.dataset.value || '';
      } else if (def.kind === 'number') {
        const n = parseFloat(el.value);
        values[def.key] = isNaN(n) ? 0 : n;
      } else {
        values[def.key] = el.value.trim ? el.value.trim() : el.value;
      }
    }
    return values;
  }

  function validateForm(type, values, selfId) {
    if (!values.name) return { msg: 'Name is required.', field: 'name' };
    const dup = records(type).find((r) =>
      r.name.trim().toLowerCase() === values.name.toLowerCase() && r.id !== selfId);
    if (dup) return { msg: 'A ' + META[type].singular + ' named "' + values.name + '" already exists.', field: 'name' };
    if (type === 'ledgers' && !values.groupId) {
      return { msg: 'Please choose a Group for this Ledger.', field: 'groupId' };
    }
    if (type === 'stockItems' && !values.unitId) {
      return { msg: 'Please choose a Unit for this Stock Item.', field: 'unitId' };
    }
    if (type === 'units' && !values.symbol) {
      return { msg: 'Symbol is required.', field: 'symbol' };
    }
    if (type === 'groups' && values.parentId) {
      const parent = findRecord('groups', values.parentId);
      if (!parent) return { msg: 'The chosen parent Group no longer exists.', field: 'parentId' };
      if (values.parentId === selfId) return { msg: 'A Group cannot be under itself.', field: 'parentId' };
    }
    return null;
  }

  function setFormError(msg, fieldKey) {
    $('#master-form-error').textContent = msg || '';
    if (fieldKey) {
      const el = $('#master-form-fields [data-field="' + fieldKey + '"]');
      if (el) el.focus();
    }
  }

  async function saveForm() {
    if (!formCtx) return;
    const type = formCtx.type;
    const values = readFormValues();
    const problem = validateForm(type, values, formCtx.id);
    if (problem) {
      setFormError(problem.msg, problem.field);
      return;
    }
    // Nature for a group under a parent always follows the parent.
    if (type === 'groups' && values.parentId) {
      values.nature = groupNature(values.parentId) || values.nature;
    }
    const m = masters();
    let savedId = formCtx.id;
    if (formCtx.id) {
      const rec = findRecord(type, formCtx.id);
      if (rec) Object.assign(rec, values, { updatedAt: new Date().toISOString() });
    } else {
      savedId = uid(META[type].prefix);
      const rec = Object.assign({ id: savedId, createdAt: new Date().toISOString() }, values);
      m[type].push(rec);
    }
    await Store.save();
    const returnTo = formCtx.returnTo;
    formCtx = null;
    if (returnTo) {
      // Came from another form's picker — go back there, with the new
      // record already chosen in that picker field.
      openForm(returnTo.type, {
        id: returnTo.id,
        draft: returnTo.draft,
        preselect: { field: returnTo.field, id: savedId },
      });
    } else {
      openList(type, savedId);
    }
  }

  function cancelForm() {
    if (!formCtx) return;
    const returnTo = formCtx.returnTo;
    formCtx = null;
    if (returnTo) {
      openForm(returnTo.type, { id: returnTo.id, draft: returnTo.draft });
    } else {
      openList(META && listCtx ? listCtx.type : 'groups');
    }
  }

  /* ================= picker dialog ================= */

  function pickerItems(def) {
    const items = [];
    // Optional pickers get a "none" row; parent pickers get "Primary".
    if (def.pickerType === 'groups' && def.key === 'parentId') {
      items.push({ id: '', label: 'Primary', sub: 'Top-level group' });
    }
    if (def.pickerType === 'godowns') {
      items.push({ id: '', label: 'None', sub: 'No godown' });
    }
    if (def.pickerType === 'costCentres' && def.key === 'parentId') {
      items.push({ id: '', label: 'Primary', sub: 'Top-level cost centre' });
    }
    const list = records(def.pickerType).slice()
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const r of list) {
      let sub = '';
      if (def.pickerType === 'groups') sub = (r.parentId ? groupName(r.parentId) : 'Primary') + ' · ' + r.nature;
      else if (def.pickerType === 'units') sub = 'Symbol: ' + r.symbol;
      else if (def.pickerType === 'godowns') sub = r.location || '';
      else if (def.pickerType === 'costCentres') sub = r.parentId ? groupName(r.parentId) : 'Primary';
      items.push({ id: r.id, label: r.name, sub });
    }
    items.push({ id: '__create__', label: 'Create', sub: 'Create a new ' + META[def.pickerType].singular });
    return items;
  }

  function openPickerFor(def, fieldBtn) {
    const items = pickerItems(def);
    Dialogs.openPicker({
      title: 'Select ' + def.label,
      items,
      onSelect: (item) => {
        if (item.id === '__create__') {
          // Create the missing master, then come back to this form
          // with everything typed so far intact.
          const draft = readFormValues();
          openForm(def.pickerType, {
            returnTo: { type: formCtx.type, field: def.key, draft, id: formCtx.id },
          });
          return;
        }
        fieldBtn.dataset.value = item.id;
        fieldBtn.querySelector('.pf-name').textContent = pickerDisplay(def, item.id);
        if (def.key === 'parentId' && formCtx.type === 'groups') syncGroupNature();
        fieldBtn.focus();
      },
      onClose: () => {
        // Esc / Cancel / overlay click: nothing changes, focus returns.
        if (fieldBtn.isConnected) fieldBtn.focus();
      },
    });
  }

  /* ================= keyboard ================= */

  function onKeyDown(e) {
    if (Dialogs.isOpen()) return; // picker / date dialogs handle their own keys
    const screen = App.currentScreen();
    let handled = false;
    if (screen === 'screen-masters') {
      if (e.key === 'ArrowDown') { e.preventDefault(); menuMove(1); handled = true; }
      else if (e.key === 'ArrowUp') { e.preventDefault(); menuMove(-1); handled = true; }
      else if (e.key === 'Enter') { e.preventDefault(); openList(MENU[menuSel]); handled = true; }
      else if (e.key === 'Escape') { e.preventDefault(); Gateway.render(); App.showScreen('screen-gateway'); handled = true; }
    } else if (screen === 'screen-master-list') {
      if (e.key === 'ArrowDown') { e.preventDefault(); listMove(1); handled = true; }
      else if (e.key === 'ArrowUp') { e.preventDefault(); listMove(-1); handled = true; }
      else if (e.key === 'Enter') {
        // Enter in the search box opens the selected row; Enter on a row
        // button clicks it natively, so only handle the search box here.
        if (e.target && e.target.id === 'master-list-search') {
          e.preventDefault();
          openSelectedRow();
          handled = true;
        }
      } else if (e.key === 'Escape') { e.preventDefault(); showMenu(); handled = true; }
    } else if (screen === 'screen-master-form') {
      if (e.key === 'Escape') { e.preventDefault(); cancelForm(); handled = true; }
      else if (e.key === 'Enter') {
        const t = e.target;
        // Buttons (picker field, Save, Cancel) handle Enter natively.
        if (t && (t.tagName === 'BUTTON')) return;
        if (t && t.matches && t.matches('input, select, textarea')) {
          e.preventDefault();
          const fields = $$('#master-form-fields input, #master-form-fields select, #master-form-fields .picker-field');
          const idx = fields.indexOf(t);
          if (idx >= 0 && idx < fields.length - 1) {
            fields[idx + 1].focus();
          } else {
            saveForm();
          }
          handled = true;
        }
      } else if (e.key.toLowerCase() === 'a' && e.ctrlKey) {
        // Ctrl+A accepts the form (Tally-style) — but never inside a text
        // field, where Ctrl+A must keep meaning "select all text".
        const t = e.target;
        if (t && t.matches && t.matches('input[type="text"], input[type="number"], textarea')) return;
        e.preventDefault();
        saveForm();
        handled = true;
      }
    }
    // This module's listener runs before App's global key handler. Once a
    // key is handled here (e.g. Esc navigates menu -> gateway), App must
    // NOT see it — otherwise App would read the NEW screen and act again
    // (Esc on the menu would land on Select Company instead of Gateway).
    if (handled) e.stopImmediatePropagation();
  }

  /* ================= boot ================= */

  function init() {
    $('#menu-masters').addEventListener('click', () => showMenu());
    $('#masters-back').addEventListener('click', () => {
      Gateway.render();
      App.showScreen('screen-gateway');
    });
    $('#master-list-back').addEventListener('click', () => showMenu());
    $('#master-list-search').addEventListener('input', (e) => {
      if (!listCtx) return;
      listCtx.filter = e.target.value;
      listCtx.sel = 0;
      renderList();
    });
    $('#master-form-save').addEventListener('click', () => saveForm());
    $('#master-form-cancel').addEventListener('click', () => cancelForm());
    $('#master-form-back').addEventListener('click', () => cancelForm());
    document.addEventListener('keydown', onKeyDown);
  }

  return { init, showMenu, openList, openForm, ensureDefaults, masters, records };
})();
