/**
 * MAYAACC — Step 0: Foundation
 * src/renderer/js/util.js — shared helpers (no framework).
 */
'use strict';

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isoOf(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function todayISO() { return isoOf(new Date()); }

/** '2026-11-17' -> '17-Nov-2026' (Tally-style display). */
function fmtDate(iso) {
  if (!iso) return '—';
  const parts = String(iso).slice(0, 10).split('-');
  if (parts.length !== 3) return iso;
  const d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
  if (isNaN(d.getTime())) return iso;
  return String(d.getDate()).padStart(2, '0') + '-' + MONTHS[d.getMonth()] + '-' + d.getFullYear();
}

/** ISO datetime -> '17-Nov-2026 12:34:56'. */
function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n) => String(n).padStart(2, '0');
  return fmtDate(isoOf(d)) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

/** Financial year end for a start date: '2026-04-01' -> '2027-03-31'. */
function fyEndOf(fyStart) {
  const p = String(fyStart).split('-');
  const d = new Date(+p[0] + 1, +p[1] - 1, +p[2]);
  d.setDate(d.getDate() - 1);
  return isoOf(d);
}

/** '2026-04-01' -> '2026-27'. */
function fyLabel(fyStart) {
  const y = parseInt(String(fyStart).slice(0, 4), 10);
  if (isNaN(y)) return '';
  return y + '-' + String((y + 1) % 100).padStart(2, '0');
}

function uid(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];
