/**
 * MAYAACC — Step 0: Foundation
 * preload.js — context bridge.
 *
 * Exposes ONLY window.mayaaccDesktop to the renderer:
 *   getPaths()        -> { dataDir, dataFile, displayPath }
 *   loadData()        -> JSON string of mayaacc-data.json, or null
 *   saveData(json)    -> { path, savedAt } (same file, updated in place)
 *   openDataFolder()  -> opens Documents\MAYAACC-Data in Explorer
 *
 * In a plain browser (verification mode) window.mayaaccDesktop is absent
 * and the renderer falls back to localStorage — same API shape, same UI.
 */

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mayaaccDesktop', {
  getPaths: () => ipcRenderer.invoke('mayaacc:get-paths'),
  loadData: () => ipcRenderer.invoke('mayaacc:load-data'),
  saveData: (jsonText) => ipcRenderer.invoke('mayaacc:save-data', jsonText),
  openDataFolder: () => ipcRenderer.invoke('mayaacc:open-data-folder'),
});
