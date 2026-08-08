'use strict';
// Filesystem-backed storage adapter. Satisfies the async storage contract by
// wrapping the existing synchronous semester-store — no behavioural change, just
// the uniform async shape that the mobile (Supabase) adapter will also expose.
const store = require('../semester-store');
const { assertStorage } = require('./contract');

// Create a filesystem-backed storage adapter bound to `dirOrResolver`
// (a directory path string, or a function returning one — mirrors ipc-handlers'
// getDir). Synchronous throws from the store surface as rejected Promises.
function createFsStorage(dirOrResolver) {
  const dir = () =>
    (typeof dirOrResolver === 'function' ? dirOrResolver() : dirOrResolver);

  const adapter = {
    list: async () => store.listSemesters(dir()),
    get: async (id) => store.getSemester(dir(), id),
    save: async (id, data) => store.saveSemester(dir(), id, data),
    delete: async (id) => store.deleteSemester(dir(), id),
  };
  return assertStorage(adapter);
}

module.exports = { createFsStorage };
