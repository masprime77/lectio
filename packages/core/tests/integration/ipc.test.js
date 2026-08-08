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
