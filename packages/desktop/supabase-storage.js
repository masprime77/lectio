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
  if (typeof module !== 'undefined' && module.exports) {
    migrate = require('@lectio/core/storage/migrate').migrateStatusToTagId;
    assertStorage = require('@lectio/core/storage/contract').assertStorage;
    module.exports = factory(migrate, assertStorage);
    return;
  }
  if (global) {
    migrate = global.PlannerMigrate && global.PlannerMigrate.migrateStatusToTagId;
    // assertStorage isn't exposed to the renderer; the adapter shape is verified
    // by the contract test in Node, so skip it here.
    const createSupabaseStorage = factory(migrate, null);
    global.createSupabaseStorage = createSupabaseStorage;
    // Construct the live adapter once the renderer client is up (11.1).
    if (global.lectioSupabase) {
      global.lectioSupabaseStorage = createSupabaseStorage(global.lectioSupabase);
    }
  }
})(typeof window !== 'undefined' ? window : null, function (migrateStatusToTagId, assertStorage) {
  const safeId = (id) => /^[a-zA-Z0-9_-]+$/.test(id);

  return function createSupabaseStorage(client) {
    const adapter = {
      async list() {
        const { data, error } = await client.from('semesters').select('id, data');
        if (error) throw error;
        return (data || []).map((r) => ({
          id: r.id,
          // Mirror mobile's `r.data?.name ?? r.id` (keeps an empty-string name).
          name: r.data && r.data.name != null ? r.data.name : r.id,
        }));
      },

      async get(id) {
        if (!safeId(id)) throw new Error(`Invalid semester id: ${id}`);
        const { data, error } = await client
          .from('semesters')
          .select('data')
          .eq('id', id)
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error(`Semester not found: ${id}`);
        return migrateStatusToTagId(data.data);
      },

      async save(id, value) {
        if (!safeId(id)) throw new Error(`Invalid semester id: ${id}`);
        const { data: u } = await client.auth.getUser();
        const user_id = u && u.user && u.user.id;
        if (!user_id) throw new Error('Not authenticated');
        const { error } = await client.from('semesters').upsert({
          id,
          user_id,
          data: value,
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
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
