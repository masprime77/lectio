'use strict';
// The canonical async storage contract every platform adapter implements.
// JS has no interfaces, so this module is the single source of truth for the
// method surface plus a runtime validator. No I/O lives here.
//
// Method shapes (all async):
//   list()        -> Promise<Array<{ id: string, name: string }>>
//   get(id)       -> Promise<Semester>     // migrated on load; rejects if missing/invalid id
//   save(id,data) -> Promise<{ ok: true, id: string }>
//   delete(id)    -> Promise<{ ok: true, id: string }>
const STORAGE_METHODS = ['list', 'get', 'save', 'delete'];

// Throws if `impl` does not look like a valid storage adapter. Returns `impl`.
function assertStorage(impl) {
  if (!impl || typeof impl !== 'object') {
    throw new Error('storage adapter must be an object');
  }
  for (const m of STORAGE_METHODS) {
    if (typeof impl[m] !== 'function') {
      throw new Error(`storage adapter missing method: ${m}`);
    }
  }
  return impl;
}

module.exports = { STORAGE_METHODS, assertStorage };
