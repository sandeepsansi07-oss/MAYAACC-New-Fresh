/**
 * MAYAACC — Step 0: Foundation
 * src/main/data-store.js
 *
 * Pure-Node data layer (no Electron import) so it can be unit-tested
 * with plain `node`. The Electron main process (main.js) requires it.
 *
 * Data file: <Documents>/MAYAACC-Data/mayaacc-data.json
 *  - ALWAYS the same file, updated in place (never a new dated file).
 *  - Daily safety backup: backups/<YYYY-MM-DD>.json (one per day, 30 days).
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function resolveDataDir(override) {
  if (override) return override;
  if (process.env.MAYAACC_DATA_DIR) return process.env.MAYAACC_DATA_DIR;
  // Windows: C:\Users\<user>\Documents\MAYAACC-Data
  // Linux dev machine: ~/Documents/MAYAACC-Data
  return path.join(os.homedir(), 'Documents', 'MAYAACC-Data');
}

function createDataStore(dataDirOverride) {
  const dir = resolveDataDir(dataDirOverride);
  const file = path.join(dir, 'mayaacc-data.json');
  const backupDir = path.join(dir, 'backups');

  function load() {
    try {
      if (!fs.existsSync(file)) return null;
      return fs.readFileSync(file, 'utf8');
    } catch (err) {
      return null;
    }
  }

  function pruneBackups() {
    try {
      if (!fs.existsSync(backupDir)) return;
      const files = fs.readdirSync(backupDir)
        .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
        .sort();
      const keep = files.slice(-30);
      for (const f of files) {
        if (!keep.includes(f)) {
          try { fs.unlinkSync(path.join(backupDir, f)); } catch (e) { /* ignore */ }
        }
      }
    } catch (err) { /* backups must never break the save */ }
  }

  function save(jsonText) {
    fs.mkdirSync(dir, { recursive: true });
    // Same file, updated in place — writeFileSync truncates and rewrites
    // the existing file (same path, same inode on most filesystems).
    fs.writeFileSync(file, jsonText, 'utf8');

    // Daily safety backup — one file per day, only if today's copy is missing.
    try {
      fs.mkdirSync(backupDir, { recursive: true });
      const today = new Date().toISOString().slice(0, 10);
      const backupFile = path.join(backupDir, today + '.json');
      if (!fs.existsSync(backupFile)) {
        fs.writeFileSync(backupFile, jsonText, 'utf8');
      }
      pruneBackups();
    } catch (err) { /* backups must never break the save */ }

    return { path: file, savedAt: new Date().toISOString() };
  }

  return { dir, file, backupDir, load, save };
}

module.exports = { createDataStore, resolveDataDir };
