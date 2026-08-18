// Supabase storage adapter satisfying the @lectio/core async storage contract.
// Mirrors device-storage.ts in shape: same method names, same id guard, same
// error messages, same migrate-on-get — it's a drop-in alternative.
import { migrateStatusToTagId } from '@lectio/core/storage/migrate';
import { assertStorage } from '@lectio/core/storage/contract';
import { detectConflict, ConflictError } from '@lectio/core/storage/conflict';
import { supabase } from '../supabase/client';
import type { Semester, SemesterSummary, Storage } from '../../types/lectio-core';

const safeId = (id: string) => /^[a-zA-Z0-9_-]+$/.test(id);

export function createSupabaseStorage(): Storage {
  // Last observed `updated_at` per id, filled on list/get and checked on save.
  // This catches every save — including the app's automatic tap-to-cycle writes —
  // without touching call sites: if the cloud row moved since we read it, save
  // throws a ConflictError instead of overwriting a newer version.
  const seen = new Map<string, string>();

  const adapter: Storage = {
    async list(): Promise<SemesterSummary[]> {
      const { data, error } = await supabase
        .from('semesters')
        .select('id, data, updated_at');
      if (error) throw error;
      const rows = data ?? [];
      for (const r of rows as any[]) {
        if (r.updated_at != null) seen.set(r.id, r.updated_at);
      }
      return rows.map((r: any) => ({ id: r.id, name: r.data?.name ?? r.id }));
    },

    async get(id: string): Promise<Semester> {
      if (!safeId(id)) throw new Error(`Invalid semester id: ${id}`);
      const { data, error } = await supabase
        .from('semesters')
        .select('data, updated_at')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error(`Semester not found: ${id}`);
      if ((data as any).updated_at != null) seen.set(id, (data as any).updated_at);
      return migrateStatusToTagId(data.data);
    },

    async save(id: string, value: Semester): Promise<{ ok: true; id: string }> {
      if (!safeId(id)) throw new Error(`Invalid semester id: ${id}`);
      const { data: u } = await supabase.auth.getUser();
      const user_id = u.user?.id;
      if (!user_id) throw new Error('Not authenticated');
      // Read the current cloud row and reject if it moved since we last saw it.
      // Costs one extra read per save — acceptable for correctness (a future
      // optimization could fold this into a conditional update).
      const { data: cur } = await supabase
        .from('semesters')
        .select('updated_at, data')
        .eq('id', id)
        .maybeSingle();
      const expected = seen.get(id) ?? null;
      const actual = (cur as any)?.updated_at ?? null;
      if (detectConflict(expected, actual)) {
        throw new ConflictError(id, {
          expectedUpdatedAt: expected,
          actualUpdatedAt: actual,
          remote: cur ? migrateStatusToTagId((cur as any).data) : null,
        });
      }
      const newTs = new Date().toISOString();
      const { data: written, error } = await supabase
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
      const storedTs = (written as any)?.updated_at ?? newTs;
      seen.set(id, storedTs);
      return { ok: true, id };
    },

    async delete(id: string): Promise<{ ok: true; id: string }> {
      if (!safeId(id)) throw new Error(`Invalid semester id: ${id}`);
      const { error } = await supabase.from('semesters').delete().eq('id', id);
      if (error) throw error;
      return { ok: true, id };
    },
  };

  return assertStorage(adapter);
}
