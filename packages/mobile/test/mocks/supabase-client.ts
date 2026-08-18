// In-memory fake of packages/mobile/src/supabase/client.ts, exposing only the
// query surface supabase-storage.ts actually uses so the adapter can run in Node
// without a real project (the real client.ts pulls in react-native + env vars and
// would throw). The shapes mirror supabase-js exactly:
//   list   → from('semesters').select('id, data, updated_at')     (bare await → all rows)
//   get    → from('semesters').select('data, updated_at').eq('id', id).maybeSingle()
//   save   → auth.getUser(), a pre-upsert select('updated_at, data').eq(...).maybeSingle()
//            conflict check, then from('semesters').upsert({ id, user_id, data, updated_at })
//   delete → from('semesters').delete().eq('id', id)
type Row = { id: string; user_id: string; data: any; updated_at?: string };

// Render a timestamp the way PostgREST renders timestamptz: microsecond
// precision and an explicit "+00:00" offset, rather than the millisecond "Z"
// ISO string a JS client writes. Same instant, different string — one half of
// what produced false "changed on another device" conflicts against the real
// project, so the fake must reproduce it or a regression won't be caught here.
function formatTimestamptz(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.` +
    `${pad(d.getUTCMilliseconds(), 3)}000+00:00`
  );
}

// The server owns updated_at: the database stamps it from its own clock, so the
// value the client sent is NOT what lands in the row — the other half of the
// same bug, and the half that survives comparing timestamps as instants rather
// than as strings. An adapter that caches its own pre-write guess instead of
// reading back what was stored will therefore never match the next read, which
// is exactly the production failure. A monotonic clock (rather than Date.now())
// keeps that deterministic and always distinct from the client's guess.
const SERVER_CLOCK_EPOCH_MS = Date.parse('2030-01-01T00:00:00.000Z');

const rows = new Map<string, Row>();
let authedUserId: string | null = 'test-user-id';
let serverClockMs = SERVER_CLOCK_EPOCH_MS;
const stampServerTime = () => formatTimestamptz((serverClockMs += 1000));

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
          // Return updated_at alongside data so the adapter can track/check it
          // (which columns were selected doesn't matter for this in-memory fake).
          return {
            data: r ? { data: r.data, updated_at: r.updated_at } : null,
            error: null,
          };
        },
        then(resolve: (v: { data: any[]; error: null }) => void) {
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
    upsert(row: Row) {
      // Note the client's own row.updated_at is discarded, as it is when the
      // column is server-owned.
      const storedUpdatedAt = stampServerTime();
      rows.set(row.id, { ...row, updated_at: storedUpdatedAt });
      return {
        select(_cols: string) {
          return {
            async maybeSingle() {
              return { data: { updated_at: storedUpdatedAt }, error: null };
            },
          };
        },
        // Still awaitable directly for a bare `await ...upsert(row)` call.
        then(resolve: (v: { error: null }) => void) {
          resolve({ error: null });
        },
      };
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
  serverClockMs = SERVER_CLOCK_EPOCH_MS;
}

/** Force the next auth.getUser() to report no signed-in user. */
export function __setUnauthenticated(): void {
  authedUserId = null;
}

/**
 * Out-of-band mutate a row's updated_at, simulating another device writing to
 * the cloud between our get() and save() — lets a test force a conflict.
 */
export function __setUpdatedAt(id: string, updated_at: string): void {
  const r = rows.get(id);
  if (r) r.updated_at = updated_at;
}
