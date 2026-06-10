'use strict';
// Registers the semester IPC handlers on a given ipcMain. `getDir` is either a
// directory string or a function returning one (so the path can be resolved
// lazily). Kept separate from main.js so tests can register against a fake
// ipcMain and a temp directory without booting Electron.
const fs = require('fs');
const path = require('path');
const store = require('./semester-store');

function registerIpcHandlers(ipcMain, getDir) {
  const dir = () => (typeof getDir === 'function' ? getDir() : getDir);

  ipcMain.handle('list-semesters', () => store.listSemesters(dir()));
  ipcMain.handle('get-semester', (event, id) => store.getSemester(dir(), id));
  ipcMain.handle('save-semester', (event, id, data) => store.saveSemester(dir(), id, data));
  ipcMain.handle('delete-semester', (event, id) => store.deleteSemester(dir(), id));

  // Export a single course to a file path chosen by the renderer (via show-save-dialog).
  ipcMain.handle('export-course', (event, { filePath, course }) => {
    if (!filePath || typeof filePath !== 'string') throw new Error('filePath required');
    const payload = {
      _lectioType: 'course',
      _version: 1,
      course,
    };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
    return { ok: true };
  });

  // Export a full semester (with tags) to a file path chosen by the renderer.
  ipcMain.handle('export-semester', (event, { filePath, semester }) => {
    if (!filePath || typeof filePath !== 'string') throw new Error('filePath required');
    const payload = {
      _lectioType: 'semester',
      _version: 1,
      semester,
    };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
    return { ok: true };
  });

  // Read and parse a .lectio.json file; returns its raw parsed content.
  // Validation of _lectioType / _version is done in the renderer. Used for both
  // dialog-picked and drag-and-drop file paths.
  ipcMain.handle('import-file', (event, { filePath }) => {
    if (!filePath || typeof filePath !== 'string') throw new Error('filePath required');
    if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  });
}

module.exports = { registerIpcHandlers };
