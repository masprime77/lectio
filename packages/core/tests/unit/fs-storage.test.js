import { afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createFsStorage } from '../../src/storage/fs-storage.js';
import { assertStorage } from '../../src/storage/contract.js';
import { runStorageContract } from '../contract/storage-contract.js';

const dirs = [];
afterEach(() => {
  while (dirs.length) fs.rmSync(dirs.pop(), { recursive: true, force: true });
});

function makeEmptyStorage() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-store-'));
  dirs.push(dir);
  return createFsStorage(dir);
}

// adapter shape check
assertStorage(makeEmptyStorage());

// full contract
runStorageContract('fs-storage', makeEmptyStorage);
