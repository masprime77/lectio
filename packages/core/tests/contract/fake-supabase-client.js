// In-memory fake Supabase client for the desktop supabase-storage contract test.
// A JS port of packages/mobile/test/mocks/supabase-client.ts, exposing only the
// query surface the desktop adapter uses so it runs in Node without a real
// project. The shapes mirror supabase-js exactly:
//   list   → from('semesters').select('id, data, updated_at')     (bare await → all rows)
//   get    → from('semesters').select('data, updated_at').eq('id', id).maybeSingle()
//   save   → auth.getUser(), a pre-upsert select('updated_at, data').eq(...).maybeSingle()
//            conflict check, then from('semesters').upsert({ id, user_id, data, updated_at })
//   delete → from('semesters').delete().eq('id', id)
//
// Each call to createFakeClient() yields a fresh, authenticated, empty store, so a
// `makeEmptyStorage` factory can build it inline (matching the contract suite).
export function createFakeClient() {
  const rows = new Map();
  let authedUserId = 'test-user-id';

  function from(table) {
    if (table !== 'semesters') throw new Error(`unexpected table ${table}`);
    return {
      select(_cols) {
        // Works BOTH as a bare awaitable (list → all rows) and as a
        // `.eq(...).maybeSingle()` chain (get → one row or null).
        const api = {
          _id: undefined,
          eq(_col, val) {
            api._id = val;
            return api;
          },
          async maybeSingle() {
            const r = api._id ? rows.get(api._id) : undefined;
            // Return updated_at alongside data so the adapter can track/check it
            // (which columns were selected doesn't matter for this in-memory fake).
            return {
              data: r ? { data: r.data, updated_at: r.updated_at } : null,
              error: null,
            };
          },
          then(resolve) {
            const all = [...rows.values()].map((r) => ({
              id: r.id,
              data: r.data,
              updated_at: r.updated_at,
            }));
            resolve({ data: all, error: null });
          },
        };
        return api;
      },
      async upsert(row) {
        rows.set(row.id, row);
        return { error: null };
      },
      delete() {
        return {
          async eq(_col, id) {
            rows.delete(id);
            return { error: null };
          },
        };
      },
    };
  }

  const client = {
    from,
    auth: {
      async getUser() {
        return { data: { user: authedUserId ? { id: authedUserId } : null } };
      },
    },
    // Test-only hook: force the next getUser() to report no signed-in user.
    __setUnauthenticated() {
      authedUserId = null;
    },
    // Test-only hook: out-of-band mutate a row's updated_at, simulating another
    // device writing between our get() and save() — lets a test force a conflict.
    __setUpdatedAt(id, updated_at) {
      const r = rows.get(id);
      if (r) r.updated_at = updated_at;
    },
  };
  return client;
}
