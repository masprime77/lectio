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
