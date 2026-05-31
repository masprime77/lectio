'use strict';
// Registers the semester IPC handlers on a given ipcMain. `getDir` is either a
// directory string or a function returning one (so the path can be resolved
// lazily). Kept separate from main.js so tests can register against a fake
// ipcMain and a temp directory without booting Electron.
const store = require('./semester-store');

function registerIpcHandlers(ipcMain, getDir) {
  const dir = () => (typeof getDir === 'function' ? getDir() : getDir);

  ipcMain.handle('list-semesters', () => store.listSemesters(dir()));
  ipcMain.handle('get-semester', (event, id) => store.getSemester(dir(), id));
  ipcMain.handle('save-semester', (event, id, data) => store.saveSemester(dir(), id, data));
  ipcMain.handle('delete-semester', (event, id) => store.deleteSemester(dir(), id));
}

module.exports = { registerIpcHandlers };
