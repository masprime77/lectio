import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import store from '../../src/semester-store.js';
import core from '../../src/planner-core.js';

let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sem-store-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const sample = {
  id: 'ss2025',
  name: 'Summer Semester 2025',
  startDate: '2025-04-07',
  weeks: 15,
  courses: [],
};

describe('semester-store (filesystem layer)', () => {
  it('list-semesters returns only .json files', () => {
    fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify({ name: 'A' }));
    fs.writeFileSync(path.join(dir, 'b.json'), JSON.stringify({ name: 'B' }));
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'ignore me');
    fs.writeFileSync(path.join(dir, 'README.md'), '# nope');

    const list = store.listSemesters(dir);
    expect(list.map((s) => s.id).sort()).toEqual(['a', 'b']);
    expect(list.find((s) => s.id === 'a').name).toBe('A');
  });

  it('get-semester returns parsed JSON with default tags migrated in', () => {
    store.saveSemester(dir, 'ss2025', sample);
    expect(store.getSemester(dir, 'ss2025')).toEqual({
      ...sample,
      readingTags: core.DEFAULT_READING_TAGS,
      taskTags: core.DEFAULT_TASK_TAGS,
    });
  });

  it('migrateStatusToTagId rewrites legacy status strings to tag ids', () => {
    const legacy = {
      id: 's',
      courses: [
        {
          id: 'c1',
          readings: [{ status: 'pending' }, { status: 'studied' }, { status: 'bogus' }],
          tasks: [{ status: 'not done' }, { status: 'done' }, { status: 'reviewed' }],
        },
      ],
    };
    const migrated = store.migrateStatusToTagId(legacy);
    expect(migrated.readingTags.map((t) => t.id)).toEqual(
      core.DEFAULT_READING_TAGS.map((t) => t.id)
    );
    expect(migrated.courses[0].readings.map((r) => r.status)).toEqual([
      'r-pending',
      'r-studied',
      'r-pending', // unknown legacy value falls back to pending
    ]);
    expect(migrated.courses[0].tasks.map((t) => t.status)).toEqual([
      't-pending',
      't-done',
      't-studied',
    ]);
  });

  it('migrateStatusToTagId leaves an already-migrated semester untouched', () => {
    const sem = {
      id: 's',
      readingTags: JSON.parse(JSON.stringify(core.DEFAULT_READING_TAGS)),
      taskTags: JSON.parse(JSON.stringify(core.DEFAULT_TASK_TAGS)),
      courses: [{ id: 'c1', readings: [{ status: 'r-seen' }], tasks: [{ status: 't-done' }] }],
    };
    store.migrateStatusToTagId(sem);
    expect(sem.courses[0].readings[0].status).toBe('r-seen');
    expect(sem.courses[0].tasks[0].status).toBe('t-done');
  });

  it('save-semester writes the correct data', () => {
    store.saveSemester(dir, 'ss2025', sample);
    const raw = fs.readFileSync(path.join(dir, 'ss2025.json'), 'utf8');
    expect(JSON.parse(raw)).toEqual(sample);
  });

  it('delete-semester removes the file', () => {
    store.saveSemester(dir, 'ss2025', sample);
    store.deleteSemester(dir, 'ss2025');
    expect(fs.existsSync(path.join(dir, 'ss2025.json'))).toBe(false);
  });

  it('requesting a non-existent semester throws a handled error', () => {
    expect(() => store.getSemester(dir, 'missing')).toThrow(/not found/i);
  });

  it('rejects ids that try to escape the directory', () => {
    expect(() => store.getSemester(dir, '../secret')).toThrow(/invalid/i);
  });
});
