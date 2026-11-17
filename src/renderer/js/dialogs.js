/**
 * MAYAACC — Step 0: Foundation (+ Step 1: picker)
 * src/renderer/js/dialogs.js — small modal dialogs.
 * Enter applies, Esc cancels. Only one dialog open at a time.
 *
 * Step 1 adds a shared PICKER dialog (Dialogs.openPicker): a search box
 * over a scrollable list. Arrow keys move the picker list (never the
 * screen behind it), Enter selects, Esc/Cancel/overlay-click closes
 * without changing anything. Every master picker uses this one dialog,
 * so the behaviour is identical everywhere.
 */
'use strict';

const Dialogs = (() => {
  let openName = null; // 'date' | 'period' | 'picker' | null
  let dateApply = null;
  let dateValidate = null;
  let periodApply = null;

  // --- picker state ---
  let picker = null; // { title, items, sel, onSelect, onClose }

  function overlay() { return $('#dialog-overlay'); }

  function dialogEl(name) {
    return name === 'picker' ? $('#dlg-picker') : $('#dlg-change-' + name);
  }

  function show(name) {
    openName = name;
    overlay().classList.remove('hidden');
    $$('.dialog').forEach((d) => d.classList.add('hidden'));
    dialogEl(name).classList.remove('hidden');
  }

  function close() {
    // Closing a picker without a selection counts as a cancel.
    if (openName === 'picker' && picker && picker.onClose) {
      const cb = picker.onClose;
      picker = null;
      openName = null;
      overlay().classList.add('hidden');
      $$('.dialog').forEach((d) => d.classList.add('hidden'));
      cb();
      return;
    }
    picker = null;
    openName = null;
    overlay().classList.add('hidden');
    $$('.dialog').forEach((d) => d.classList.add('hidden'));
  }

  function isOpen() { return openName !== null; }

  function openDate(currentISO, onApply, validateFn) {
    dateApply = onApply;
    dateValidate = validateFn || null;
    $('#dlg-date-error').textContent = '';
    $('#dlg-date-input').value = currentISO || '';
    show('date');
    setTimeout(() => $('#dlg-date-input').focus(), 0);
  }

  function openPeriod(period, onApply) {
    periodApply = onApply;
    $('#dlg-period-error').textContent = '';
    $('#dlg-period-from').value = (period && period.from) || '';
    $('#dlg-period-to').value = (period && period.to) || '';
    show('period');
    setTimeout(() => $('#dlg-period-from').focus(), 0);
  }

  function applyDate() {
    const val = $('#dlg-date-input').value;
    if (!val) {
      $('#dlg-date-error').textContent = 'Please pick a date.';
      return;
    }
    if (dateValidate) {
      const problem = dateValidate(val);
      if (problem) {
        $('#dlg-date-error').textContent = problem;
        return;
      }
    }
    const cb = dateApply;
    close();
    if (cb) cb(val);
  }

  function applyPeriod() {
    const from = $('#dlg-period-from').value;
    const to = $('#dlg-period-to').value;
    if (!from || !to) {
      $('#dlg-period-error').textContent = 'Please pick both From and To dates.';
      return;
    }
    if (from > to) {
      $('#dlg-period-error').textContent = 'From date cannot be after To date.';
      return;
    }
    const cb = periodApply;
    close();
    if (cb) cb({ from, to });
  }

  /* ---------- picker ---------- */

  function pickerFiltered() {
    const q = ($('#dlg-picker-search').value || '').trim().toLowerCase();
    if (!q) return picker.items;
    return picker.items.filter((it) =>
      (it.label || '').toLowerCase().includes(q) ||
      (it.sub || '').toLowerCase().includes(q));
  }

  function renderPicker() {
    const list = pickerFiltered();
    if (picker.sel > list.length - 1) picker.sel = Math.max(0, list.length - 1);
    $('#dlg-picker-title').textContent = picker.title || 'Select';
    const listEl = $('#dlg-picker-list');
    listEl.innerHTML = '';
    list.forEach((it, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'picker-row' + (it.id === '__create__' ? ' create-row' : '') +
        (idx === picker.sel ? ' sel' : '');
      btn.setAttribute('role', 'option');
      const name = document.createElement('span');
      name.className = 'pr-name';
      name.textContent = it.id === '__create__' ? '+ ' + it.label : it.label;
      btn.appendChild(name);
      if (it.sub) {
        const sub = document.createElement('span');
        sub.className = 'pr-sub';
        sub.textContent = it.sub;
        btn.appendChild(sub);
      }
      btn.addEventListener('click', () => { picker.sel = idx; pickerSelect(); });
      btn.addEventListener('mouseenter', () => { picker.sel = idx; paintPickerSel(); });
      listEl.appendChild(btn);
    });
  }

  function paintPickerSel() {
    $$('#dlg-picker-list .picker-row').forEach((el, idx) => {
      el.classList.toggle('sel', idx === picker.sel);
    });
  }

  function pickerMove(d) {
    if (!picker) return;
    const list = pickerFiltered();
    if (list.length === 0) return;
    picker.sel = Math.max(0, Math.min(list.length - 1, picker.sel + d));
    paintPickerSel();
    const el = $$('#dlg-picker-list .picker-row')[picker.sel];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  function pickerSelect() {
    if (!picker) return;
    const list = pickerFiltered();
    const item = list[picker.sel];
    if (!item) return;
    const cb = picker.onSelect;
    // Close WITHOUT firing onClose (this was a selection, not a cancel).
    picker = null;
    openName = null;
    overlay().classList.add('hidden');
    $$('.dialog').forEach((d) => d.classList.add('hidden'));
    if (cb) cb(item);
  }

  function openPicker(opts) {
    picker = {
      title: opts.title || 'Select',
      items: opts.items || [],
      sel: 0,
      onSelect: opts.onSelect || null,
      onClose: opts.onClose || null,
    };
    $('#dlg-picker-search').value = '';
    renderPicker();
    show('picker');
    setTimeout(() => $('#dlg-picker-search').focus(), 0);
  }

  function init() {
    $('#dlg-date-ok').addEventListener('click', applyDate);
    $('#dlg-date-cancel').addEventListener('click', close);
    $('#dlg-period-ok').addEventListener('click', applyPeriod);
    $('#dlg-period-cancel').addEventListener('click', close);
    $('#dlg-picker-cancel').addEventListener('click', close);
    $('#dlg-picker-search').addEventListener('input', () => {
      if (!picker) return;
      picker.sel = 0;
      renderPicker();
    });
    overlay().addEventListener('click', (e) => {
      if (e.target === overlay()) close();
    });
    overlay().addEventListener('keydown', (e) => {
      if (openName === 'picker') {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); pickerMove(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); pickerMove(-1); }
        else if (e.key === 'Enter' && e.target && e.target.matches('input')) {
          e.preventDefault();
          pickerSelect();
        }
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === 'Enter' && e.target && e.target.matches('input')) {
        e.preventDefault();
        if (openName === 'date') applyDate();
        else if (openName === 'period') applyPeriod();
      }
    });
  }

  return { init, openDate, openPeriod, openPicker, close, isOpen };
})();
