// Supabase storage adapter satisfying the @lectio/core async storage contract.
// Mirrors device-storage.ts in shape: same method names, same id guard, same
// error messages, same migrate-on-get — it's a drop-in alternative.
import { migrateStatusToTagId } from '@lectio/core/storage/migrate';
import { assertStorage } from '@lectio/core/storage/contract';
import { supabase } from '../supabase/client';
import type { Semester, SemesterSummary, Storage } from '../../types/lectio-core';

const safeId = (id: string) => /^[a-zA-Z0-9_-]+$/.test(id);

export function createSupabaseStorage(): Storage {
  const adapter: Storage = {
    async list(): Promise<SemesterSummary[]> {
      const { data, error } = await supabase.from('semesters').select('id, data');
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ id: r.id, name: r.data?.name ?? r.id }));
    },

    async get(id: string): Promise<Semester> {
      if (!safeId(id)) throw new Error(`Invalid semester id: ${id}`);
      const { data, error } = await supabase
        .from('semesters')
        .select('data')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error(`Semester not found: ${id}`);
      return migrateStatusToTagId(data.data);
    },

    async save(id: string, value: Semester): Promise<{ ok: true; id: string }> {
      if (!safeId(id)) throw new Error(`Invalid semester id: ${id}`);
      const { data: u } = await supabase.auth.getUser();
      const user_id = u.user?.id;
      if (!user_id) throw new Error('Not authenticated');
      const { error } = await supabase.from('semesters').upsert({
        id,
        user_id,
        data: value,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
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
