const { contextBridge, ipcRenderer } = require('electron');

// Expose a minimal, safe API to the renderer. ipcRenderer itself is never
// exposed — only these four wrapped methods cross the bridge.
contextBridge.exposeInMainWorld('planner', {
  listSemesters: () => ipcRenderer.invoke('list-semesters'),
  getSemester: (id) => ipcRenderer.invoke('get-semester', id),
  saveSemester: (id, data) => ipcRenderer.invoke('save-semester', id, data),
  deleteSemester: (id) => ipcRenderer.invoke('delete-semester', id),
});
