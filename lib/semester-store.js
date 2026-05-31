'use strict';
// Filesystem layer for semester JSON files. Pure Node — no Electron — so it can
// be unit-tested directly against a temp directory. The main process wires
// these into ipcMain handlers (see lib/ipc-handlers.js).
const fs = require('fs');
const path = require('path');

// Reject ids that could escape the semesters directory.
const safeId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id);
const fileFor = (dir, id) => path.join(dir, `${id}.json`);

// List all semesters as { id, name }, reading only *.json files.
function listSemesters(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      return { id: path.basename(f, '.json'), name: data.name || data.id };
    });
}

// Read and parse one semester. Throws a handled error for invalid or missing ids.
function getSemester(dir, id) {
  if (!safeId(id)) throw new Error(`Invalid semester id: ${id}`);
  const file = fileFor(dir, id);
  if (!fs.existsSync(file)) throw new Error(`Semester not found: ${id}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// Write a semester JSON file (pretty-printed). Creates the dir if needed.
function saveSemester(dir, id, data) {
  if (!safeId(id)) throw new Error(`Invalid semester id: ${id}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fileFor(dir, id), JSON.stringify(data, null, 2));
  return { ok: true, id };
}

// Delete a semester file. Throws a handled error for invalid or missing ids.
function deleteSemester(dir, id) {
  if (!safeId(id)) throw new Error(`Invalid semester id: ${id}`);
  const file = fileFor(dir, id);
  if (!fs.existsSync(file)) throw new Error(`Semester not found: ${id}`);
  fs.unlinkSync(file);
  return { ok: true, id };
}

module.exports = { safeId, listSemesters, getSemester, saveSemester, deleteSemester };
