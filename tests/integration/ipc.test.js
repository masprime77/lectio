import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { registerIpcHandlers } from '../../lib/ipc-handlers.js';

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
  it('registers all four semester channels', () => {
    expect(ipc.channels()).toEqual([
      'delete-semester',
      'get-semester',
      'list-semesters',
      'save-semester',
    ]);
  });

  it('list-semesters with an empty folder returns []', async () => {
    await expect(ipc.invoke('list-semesters')).resolves.toEqual([]);
  });

  it('save-semester followed by get-semester returns the same data', async () => {
    await ipc.invoke('save-semester', 'x', sample);
    await expect(ipc.invoke('get-semester', 'x')).resolves.toEqual(sample);
    await expect(ipc.invoke('list-semesters')).resolves.toEqual([{ id: 'x', name: 'X' }]);
  });

  it('delete-semester followed by get-semester throws a not-found error', async () => {
    await ipc.invoke('save-semester', 'x', sample);
    await ipc.invoke('delete-semester', 'x');
    await expect(ipc.invoke('get-semester', 'x')).rejects.toThrow(/not found/i);
  });
});
