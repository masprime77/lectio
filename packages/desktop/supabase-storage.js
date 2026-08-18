'use strict';
// Desktop Supabase storage adapter — a vanilla-JS mirror of the mobile
// supabase-storage.ts (packages/mobile/src/storage/supabase-storage.ts),
// satisfying @lectio/core's async storage contract. Same id guard, same error
// strings, same migrate-on-get, so it's a drop-in alternative byte-compatible
// with the fs / device / mobile adapters.
//
// Dual-mode like planner-core.js:
//   - Renderer: loaded via <script> AFTER planner-core.js + migrate.js (reads
//     window.PlannerMigrate) and supabase-client.js; attaches window.lectioSupabaseStorage.
//   - Node / Vitest: require()d; pulls migrate + assertStorage from @lectio/core.
//
// createSupabaseStorage(client) takes the Supabase client by INJECTION — the
// renderer passes window.lectioSupabase, the contract test passes an in-memory
// fake — so the adapter runs in Node without UMD/window globals.
(function (global, factory) {
  let migrate;
  let assertStorage;
  let detectConflict;
  let ConflictError;
  if (typeof module !== 'undefined' && module.exports) {
    migrate = require('@lectio/core/storage/migrate').migrateStatusToTagId;
    assertStorage = require('@lectio/core/storage/contract').assertStorage;
    const conflict = require('@lectio/core/storage/conflict');
    detectConflict = conflict.detectConflict;
    ConflictError = conflict.ConflictError;
    module.exports = factory(migrate, assertStorage, detectConflict, ConflictError);
    return;
  }
  if (global) {
    migrate = global.PlannerMigrate && global.PlannerMigrate.migrateStatusToTagId;
    // conflict.js is vendored + loaded before this file (see index.html), exposing
    // window.PlannerConflict — the same pattern as migrate → window.PlannerMigrate.
    // If the build shipped without it, taking `undefined` here would defer the
    // failure to the first cloud save, where it reads as an unrelated TypeError
    // — so refuse to build an adapter that cannot detect conflicts.
    const conflict = global.PlannerConflict;
    const hasConflict =
      conflict && typeof conflict.detectConflict === 'function' && typeof conflict.ConflictError === 'function';
    detectConflict = hasConflict ? conflict.detectConflict : null;
    ConflictError = hasConflict ? conflict.ConflictError : null;
    // assertStorage isn't exposed to the renderer; the adapter shape is verified
    // by the contract test in Node, so skip it here.
    const createSupabaseStorage = hasConflict
      ? factory(migrate, null, detectConflict, ConflictError)
      : () => {
          throw new Error(
            'Cloud storage is unavailable: window.PlannerConflict is missing (conflict.js was ' +
              'not loaded). This build of Lectio is incomplete — reinstall or update the app.'
          );
        };
    global.createSupabaseStorage = createSupabaseStorage;
    // Construct the live adapter once the renderer client is up (11.1).
    if (global.lectioSupabase) {
      global.lectioSupabaseStorage = createSupabaseStorage(global.lectioSupabase);
    }
  }
})(typeof window !== 'undefined' ? window : null, function (
  migrateStatusToTagId,
  assertStorage,
  detectConflict,
  ConflictError
) {
  const safeId = (id) => /^[a-zA-Z0-9_-]+$/.test(id);

  return function createSupabaseStorage(client) {
    // Last observed `updated_at` per id, filled on list/get and checked on save —
    // see the mobile supabase-storage.ts for the rationale (kept byte-symmetric).
    const seen = new Map();

    const adapter = {
      async list() {
        const { data, error } = await client
          .from('semesters')
          .select('id, data, updated_at');
        if (error) throw error;
        const rows = data || [];
        for (const r of rows) {
          if (r.updated_at != null) seen.set(r.id, r.updated_at);
        }
        return rows.map((r) => ({
          id: r.id,
          // Mirror mobile's `r.data?.name ?? r.id` (keeps an empty-string name).
          name: r.data && r.data.name != null ? r.data.name : r.id,
        }));
      },

      async get(id) {
        if (!safeId(id)) throw new Error(`Invalid semester id: ${id}`);
        const { data, error } = await client
          .from('semesters')
          .select('data, updated_at')
          .eq('id', id)
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error(`Semester not found: ${id}`);
        if (data.updated_at != null) seen.set(id, data.updated_at);
        return migrateStatusToTagId(data.data);
      },

      async save(id, value) {
        if (!safeId(id)) throw new Error(`Invalid semester id: ${id}`);
        const { data: u } = await client.auth.getUser();
        const user_id = u && u.user && u.user.id;
        if (!user_id) throw new Error('Not authenticated');
        // Read the current cloud row and reject if it moved since we last saw it
        // (one extra read per save — acceptable for correctness).
        const { data: cur } = await client
          .from('semesters')
          .select('updated_at, data')
          .eq('id', id)
          .maybeSingle();
        const expected = seen.has(id) ? seen.get(id) : null;
        const actual = cur && cur.updated_at != null ? cur.updated_at : null;
        if (detectConflict(expected, actual)) {
          throw new ConflictError(id, {
            expectedUpdatedAt: expected,
            actualUpdatedAt: actual,
            remote: cur ? migrateStatusToTagId(cur.data) : null,
          });
        }
        const newTs = new Date().toISOString();
        const { data: written, error } = await client
          .from('semesters')
          .upsert({ id, user_id, data: value, updated_at: newTs })
          .select('updated_at')
          .maybeSingle();
        if (error) throw error;
        // Trust whatever Postgres actually stored over our own local guess: if
        // it reformats the timestamp (or a trigger owns the column), our guess
        // won't match the next read, and every following save would falsely
        // conflict against its own prior write. Fall back to the local guess
        // only if the write somehow didn't return a row.
        const storedTs = written && written.updated_at != null ? written.updated_at : newTs;
        seen.set(id, storedTs);
        return { ok: true, id };
      },

      async delete(id) {
        if (!safeId(id)) throw new Error(`Invalid semester id: ${id}`);
        const { error } = await client.from('semesters').delete().eq('id', id);
        if (error) throw error;
        return { ok: true, id };
      },
    };

    return assertStorage ? assertStorage(adapter) : adapter;
  };
});
