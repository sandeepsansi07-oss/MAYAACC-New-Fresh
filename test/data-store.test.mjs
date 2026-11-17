/**
 * MAYAACC — Step 0: Foundation
 * test/data-store.test.mjs — Node test for src/main/data-store.js.
 *
 * Proves the real-file behaviour that the browser cannot see:
 *   1. save() writes the SAME file in place (same inode, new content).
 *   2. a second save updates the content again (no new file).
 *   3. daily backup: one file per day, second save same day adds none.
 *   4. load() reads back what was saved.
 *   5. backups older than 30 days are pruned.
 *
 * Run: npm test
 */
'use strict';

import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { createDataStore } = require('../src/main/data-store.js');

let pass = 0;
let fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? ' — ' + extra : '')); }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mayaacc-step0-'));
const store = createDataStore(tmp);
console.log('Data dir under test: ' + tmp);

// 1. load() on empty dir -> null
check('load() returns null when no file exists', store.load() === null);

// 2. first save creates the file
const r1 = store.save(JSON.stringify({ version: '0.1.0', companies: [] }));
check('save() returns path + savedAt', !!r1.path && !!r1.savedAt);
check('data file exists at <dir>/mayaacc-data.json', fs.existsSync(path.join(tmp, 'mayaacc-data.json')));
const ino1 = fs.statSync(path.join(tmp, 'mayaacc-data.json')).ino;

// 3. second save: SAME file in place (same inode), content updated
store.save(JSON.stringify({ version: '0.1.0', companies: [{ id: 'c_1', name: 'Sharma Traders' }] }));
const ino2 = fs.statSync(path.join(tmp, 'mayaacc-data.json')).ino;
check('second save updates the SAME file (inode unchanged)', ino1 === ino2, 'ino ' + ino1 + ' vs ' + ino2);
const back = JSON.parse(store.load());
check('load() reads back updated content', back.companies.length === 1 && back.companies[0].name === 'Sharma Traders');

// 4. daily backup: one file per day
const backups = fs.readdirSync(path.join(tmp, 'backups'));
check('exactly one backup file after two saves same day', backups.length === 1, JSON.stringify(backups));
check('backup file is named by today\'s date', /^\d{4}-\d{2}-\d{2}\.json$/.test(backups[0]));
const backupContent = JSON.parse(fs.readFileSync(path.join(tmp, 'backups', backups[0]), 'utf8'));
check('backup holds the FIRST save of the day', backupContent.companies.length === 0);

// 5. pruning: plant 35 old backup files, save, expect only 30 remain
for (let i = 1; i <= 35; i++) {
  const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
  fs.writeFileSync(path.join(tmp, 'backups', d + '.json'), '{}', 'utf8');
}
store.save(JSON.stringify({ version: '0.1.0', companies: [] }));
const after = fs.readdirSync(path.join(tmp, 'backups'));
check('backups pruned to 30 days', after.length === 30, 'got ' + after.length);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
