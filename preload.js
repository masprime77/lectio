const { contextBridge, ipcRenderer } = require('electron');

// Expose a minimal, safe API to the renderer. ipcRenderer itself is never
// exposed — only these four wrapped methods cross the bridge.
contextBridge.exposeInMainWorld('planner', {
  listSemesters: () => ipcRenderer.invoke('list-semesters'),
  getSemester: (id) => ipcRenderer.invoke('get-semester', id),
  saveSemester: (id, data) => ipcRenderer.invoke('save-semester', id, data),
  deleteSemester: (id) => ipcRenderer.invoke('delete-semester', id),
});

// Auto-update bridge. Main → renderer notifications plus a restart trigger.
contextBridge.exposeInMainWorld('updater', {
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', () => callback()),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', () => callback()),
  restartAndUpdate: () => ipcRenderer.invoke('restart-and-update'),
});

// Save bridge: File → Save trigger, dirty-state reporting, and the
// save-before-quit handshake used by the unsaved-changes close prompt.
contextBridge.exposeInMainWorld('saver', {
  onMenuSave: (callback) => ipcRenderer.on('menu-save', () => callback()),
  setDirty: (dirty) => ipcRenderer.send('set-dirty', !!dirty),
  onFlushSaveAndQuit: (callback) => ipcRenderer.on('flush-save-and-quit', () => callback()),
  saveAndQuitDone: () => ipcRenderer.invoke('save-and-quit-done'),
});

// App info (read-only).
contextBridge.exposeInMainWorld('appInfo', {
  getVersion: () => ipcRenderer.invoke('get-version'),
});

// External links: open a URL in the default browser. Main restricts this to
// https github.com URLs (used for the pre-filled feedback issue links).
// NB: named `externalLinks`, not `external` — `window.external` is a built-in
// browser property and exposeInMainWorld can't bind on top of it.
contextBridge.exposeInMainWorld('externalLinks', {
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
});

// Settings bridge: file-based settings (settings.json) read/write, plus the
// "open settings" signal from the menu / Cmd+, accelerator.
contextBridge.exposeInMainWorld('settings', {
  get: () => ipcRenderer.invoke('get-settings'),
  save: (data) => ipcRenderer.invoke('save-settings', data),
  onOpen: (callback) => ipcRenderer.on('open-settings', () => callback()),
});
