'use strict';
// Filesystem layer for semester JSON files. Pure Node — no Electron — so it can
// be unit-tested directly against a temp directory. The main process wires
// these into ipcMain handlers (see lib/ipc-handlers.js).
const fs = require('fs');
const path = require('path');
const { DEFAULT_READING_TAGS, DEFAULT_TASK_TAGS, getCourses } = require('./planner-core');

// Reject ids that could escape the semesters directory.
const safeId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id);
const fileFor = (dir, id) => path.join(dir, `${id}.json`);

// Bring legacy semesters up to the tag-based status model. Adds the default
// tag sets and rewrites each item's `status` from a name string to a tag id.
// Idempotent: semesters that already carry tags are left untouched.
function migrateStatusToTagId(semester) {
  if (!Array.isArray(semester.readingTags) || semester.readingTags.length === 0) {
    semester.readingTags = JSON.parse(JSON.stringify(DEFAULT_READING_TAGS));
    const map = {
      pending: 'r-pending',
      seen: 'r-seen',
      summarized: 'r-summarized',
      studied: 'r-studied',
    };
    getCourses(semester).forEach((c) =>
      (c.readings || []).forEach((r) => {
        r.status = map[r.status] || 'r-pending';
      })
    );
  }
  if (!Array.isArray(semester.taskTags) || semester.taskTags.length === 0) {
    semester.taskTags = JSON.parse(JSON.stringify(DEFAULT_TASK_TAGS));
    const map = { 'not done': 't-pending', done: 't-done', reviewed: 't-studied' };
    getCourses(semester).forEach((c) =>
      (c.tasks || []).forEach((t) => {
        t.status = map[t.status] || 't-pending';
      })
    );
  }
  return semester;
}

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
  return migrateStatusToTagId(JSON.parse(fs.readFileSync(file, 'utf8')));
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

module.exports = {
  safeId,
  listSemesters,
  getSemester,
  saveSemester,
  deleteSemester,
  migrateStatusToTagId,
};
