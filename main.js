/**
 * MAYAACC — Step 0: Foundation
 * main.js — Electron main process (Windows).
 *
 * Window + IPC only. All data-file logic lives in src/main/data-store.js
 * (pure Node, unit-testable). The renderer never touches the filesystem
 * directly; it talks through the preload bridge.
 */

'use strict';

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { createDataStore } = require('./src/main/data-store');

const store = createDataStore();

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: 'MAYAACC',
    backgroundColor: '#16233f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));

  mainWindow.on('closed', () => { mainWindow = null; });
}

// --- IPC: data -------------------------------------------------------------

ipcMain.handle('mayaacc:get-paths', () => ({
  dataDir: store.dir,
  dataFile: store.file,
  displayPath: store.file,
}));

ipcMain.handle('mayaacc:load-data', () => store.load());

ipcMain.handle('mayaacc:save-data', (_event, jsonText) => {
  if (typeof jsonText !== 'string') throw new Error('save-data expects a JSON string');
  return store.save(jsonText);
});

ipcMain.handle('mayaacc:open-data-folder', async () => {
  await shell.openPath(store.dir);
  return true;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
