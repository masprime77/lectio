// In-memory fake of packages/mobile/src/supabase/client.ts, exposing only the
// query surface supabase-storage.ts actually uses so the adapter can run in Node
// without a real project (the real client.ts pulls in react-native + env vars and
// would throw). The shapes mirror supabase-js exactly:
//   list   → from('semesters').select('id, data')              (bare await → all rows)
//   get    → from('semesters').select('data').eq('id', id).maybeSingle()
//   save   → auth.getUser() then from('semesters').upsert({ id, user_id, data, updated_at })
//   delete → from('semesters').delete().eq('id', id)
type Row = { id: string; user_id: string; data: any; updated_at?: string };

const rows = new Map<string, Row>();
let authedUserId: string | null = 'test-user-id';

function from(table: string) {
  if (table !== 'semesters') throw new Error(`unexpected table ${table}`);
  return {
    select(_cols: string) {
      // The returned value works BOTH as a bare awaitable (list → all rows) and
      // as a `.eq(...).maybeSingle()` chain (get → one row or null).
      const api = {
        _id: undefined as string | undefined,
        eq(_col: string, val: string) {
          api._id = val;
          return api;
        },
        async maybeSingle() {
          const r = api._id ? rows.get(api._id) : undefined;
          return { data: r ? { data: r.data } : null, error: null };
        },
        then(resolve: (v: { data: any[]; error: null }) => void) {
          const all = [...rows.values()].map((r) => ({ id: r.id, data: r.data }));
          resolve({ data: all, error: null });
        },
      };
      return api;
    },
    async upsert(row: Row) {
      rows.set(row.id, row);
      return { error: null };
    },
    delete() {
      return {
        async eq(_col: string, id: string) {
          rows.delete(id);
          return { error: null };
        },
      };
    },
  };
}

export const supabase = {
  from,
  auth: {
    async getUser() {
      return { data: { user: authedUserId ? { id: authedUserId } : null } };
    },
  },
};

/** Reset to an empty, authenticated store between contract cases. */
export function __reset(): void {
  rows.clear();
  authedUserId = 'test-user-id';
}

/** Force the next auth.getUser() to report no signed-in user. */
export function __setUnauthenticated(): void {
  authedUserId = null;
}
