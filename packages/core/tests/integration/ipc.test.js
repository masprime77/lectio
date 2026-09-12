import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { registerIpcHandlers } from '../../src/ipc-handlers.js';
import core from '../../src/planner-core.js';

// Minimal mock of Electron's ipcMain: records handlers and lets us invoke them
// the way the renderer would (ipcRenderer.invoke → ipcMain.handle).
function fakeIpcMain() {
  const handlers = {};
  return {
    handle: (channel, fn) => {
      handlers[channel] = fn;
    },
    // Resolve through a promise so synchronous throws surface as rejections,
    // mirroring ipcRenderer.invoke's behaviour.
    invoke: (channel, ...args) => Promise.resolve().then(() => handlers[channel]({}, ...args)),
    channels: () => Object.keys(handlers).sort(),
  };
}

let dir;
let ipc;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ipc-'));
  ipc = fakeIpcMain();
  registerIpcHandlers(ipc, () => dir);
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const sample = { id: 'x', name: 'X', startDate: '2025-01-06', weeks: 4, courses: [] };

describe('IPC handlers', () => {
  it('registers the semester and export/import channels', () => {
    expect(ipc.channels()).toEqual([
      'delete-semester',
      'export-course',
      'export-semester',
      'get-semester',
      'import-file',
      'list-semesters',
      'save-semester',
    ]);
  });

  it('list-semesters with an empty folder returns []', async () => {
    await expect(ipc.invoke('list-semesters')).resolves.toEqual([]);
  });

  it('save-semester followed by get-semester returns the data with tags migrated in', async () => {
    await ipc.invoke('save-semester', 'x', sample);
    // get-semester migrates legacy data on load, adding the default tag sets.
    await expect(ipc.invoke('get-semester', 'x')).resolves.toEqual({
      ...sample,
      readingTags: core.DEFAULT_READING_TAGS,
      taskTags: core.DEFAULT_TASK_TAGS,
    });
    await expect(ipc.invoke('list-semesters')).resolves.toEqual([{ id: 'x', name: 'X' }]);
  });

  it('get-semester migrates legacy reading/task statuses to tag ids', async () => {
    const legacy = {
      id: 'y',
      name: 'Y',
      startDate: '2025-01-06',
      weeks: 4,
      courses: [
        {
          id: 'c1',
          name: 'C1',
          color: '#000',
          readings: [{ id: 'r1', week: 1, title: 'R', status: 'summarized' }],
          tasks: [{ id: 't1', week: 1, title: 'T', status: 'not done' }],
        },
      ],
    };
    await ipc.invoke('save-semester', 'y', legacy);
    const loaded = await ipc.invoke('get-semester', 'y');
    expect(loaded.courses[0].readings[0].status).toBe('r-summarized');
    expect(loaded.courses[0].tasks[0].status).toBe('t-pending');
  });

  it('delete-semester followed by get-semester throws a not-found error', async () => {
    await ipc.invoke('save-semester', 'x', sample);
    await ipc.invoke('delete-semester', 'x');
    await expect(ipc.invoke('get-semester', 'x')).rejects.toThrow(/not found/i);
  });
});

// The three file handlers write and read real paths, so they get their own
// block: the suite above only ever asserted that they were registered.
describe('export/import IPC handlers', () => {
  const course = {
    id: 'c1',
    name: 'Algorithms',
    color: '#4A90D9',
    examDate: '2025-07-21',
    readings: [{ id: 'r1', week: 1, title: 'Chapter 1', status: 'r-pending', note: 'keep me' }],
    tasks: [{ id: 't1', week: 1, title: 'Set 1', dueDate: '2025-01-13', status: 't-pending' }],
  };
  const out = (name) => path.join(dir, name);

  describe('export-semester', () => {
    it('writes a semester envelope the file system can read back', async () => {
      const file = out('sem.lectio.json');
      await expect(ipc.invoke('export-semester', { filePath: file, semester: sample })).resolves.toEqual({
        ok: true,
      });
      const written = JSON.parse(fs.readFileSync(file, 'utf8'));
      expect(written._lectioType).toBe('semester');
      expect(written._version).toBe(1);
      expect(written.semester).toEqual(sample);
    });

    it('rejects a missing or empty filePath', async () => {
      await expect(ipc.invoke('export-semester', { semester: sample })).rejects.toThrow(
        /filePath required/
      );
      await expect(
        ipc.invoke('export-semester', { filePath: '', semester: sample })
      ).rejects.toThrow(/filePath required/);
    });

    it('rejects a filePath that is not .lectio.json, writing nothing', async () => {
      const file = out('sem.json');
      await expect(
        ipc.invoke('export-semester', { filePath: file, semester: sample })
      ).rejects.toThrow(/must end with \.lectio\.json/);
      expect(fs.existsSync(file)).toBe(false);
    });
  });

  describe('export-course', () => {
    it('writes a course envelope, keeping item notes', async () => {
      const file = out('course.lectio.json');
      await expect(ipc.invoke('export-course', { filePath: file, course })).resolves.toEqual({
        ok: true,
      });
      const written = JSON.parse(fs.readFileSync(file, 'utf8'));
      expect(written._lectioType).toBe('course');
      expect(written._version).toBe(1);
      expect(written.course.name).toBe('Algorithms');
      expect(written.course.readings[0].note).toBe('keep me');
      // The envelope carries no semester-level tag sets.
      expect(written.course.readingTags).toBeUndefined();
    });

    it('rejects a missing filePath', async () => {
      await expect(ipc.invoke('export-course', { course })).rejects.toThrow(/filePath required/);
    });

    it('rejects a filePath that is not .lectio.json, writing nothing', async () => {
      const file = out('course.txt');
      await expect(ipc.invoke('export-course', { filePath: file, course })).rejects.toThrow(
        /must end with \.lectio\.json/
      );
      expect(fs.existsSync(file)).toBe(false);
    });
  });

  describe('import-file', () => {
    it('round-trips an exported semester', async () => {
      const file = out('round.lectio.json');
      await ipc.invoke('export-semester', { filePath: file, semester: sample });
      const payload = await ipc.invoke('import-file', { filePath: file });
      expect(payload._lectioType).toBe('semester');
      expect(payload.semester).toEqual(sample);
    });

    it('rejects a missing filePath', async () => {
      await expect(ipc.invoke('import-file', {})).rejects.toThrow(/filePath required/);
    });

    it('rejects a filePath that is not .lectio.json even when the file exists', async () => {
      const file = out('real.json');
      fs.writeFileSync(file, JSON.stringify({ _lectioType: 'semester', semester: sample }));
      await expect(ipc.invoke('import-file', { filePath: file })).rejects.toThrow(
        /must end with \.lectio\.json/
      );
    });

    it('rejects a path that does not exist', async () => {
      await expect(ipc.invoke('import-file', { filePath: out('nope.lectio.json') })).rejects.toThrow(
        /File not found/
      );
    });

    it('propagates a JSON parse failure for a malformed file', async () => {
      const file = out('bad.lectio.json');
      fs.writeFileSync(file, '{ not json at all');
      // The handler does not catch this; the renderer surfaces it as
      // "Could not read file: ...".
      await expect(ipc.invoke('import-file', { filePath: file })).rejects.toThrow(SyntaxError);
    });
  });
});
