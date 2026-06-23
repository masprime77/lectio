import AsyncStorageMock from './mocks/async-storage';
import { createDeviceStorage } from '../src/storage/device-storage';
import { assertStorage } from '@lectio/core/storage/contract';
// storage-contract.js lives under core's tests (not in core's package "exports"),
// so import it by relative path to the core file. It is intentionally not named
// *.test.js, so Vitest won't collect it standalone — it's the shared suite.
import { runStorageContract } from '../../core/tests/contract/storage-contract.js';

// Each factory call must yield empty storage; the mock store is module-level, so
// reset it before handing back a fresh adapter.
function makeEmptyStorage() {
  AsyncStorageMock.__reset();
  return createDeviceStorage();
}

// adapter shape check
assertStorage(makeEmptyStorage());

// full contract
runStorageContract('device-storage', makeEmptyStorage);
