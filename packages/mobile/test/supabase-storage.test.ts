import { describe, it, expect, vi } from 'vitest';

// Redirect the adapter's `import { supabase } from '../supabase/client'` to the
// in-memory fake. We mock by the adapter's resolved module (test-relative
// `../src/supabase/client` resolves to the same absolute file the adapter's own
// `../supabase/client` does), so both share one fake instance. A config alias by
// absolute path can't intercept a relative specifier, hence vi.mock here.
vi.mock('../src/supabase/client', () => import('./mocks/supabase-client'));

import {
  __reset,
  __setUnauthenticated,
  __setUpdatedAt,
} from './mocks/supabase-client';
import { createSupabaseStorage } from '../src/storage/supabase-storage';
import { assertStorage } from '@lectio/core/storage/contract';
import { runStorageContract } from '../../core/tests/contract/storage-contract.js';

// Each factory call must yield empty, authenticated storage.
function makeEmptyStorage() {
  __reset();
  return createSupabaseStorage();
}

// adapter shape check
assertStorage(makeEmptyStorage());

// full contract
runStorageContract('supabase-storage', makeEmptyStorage);

// Beyond the contract: the adapter's auth guard (not exercised by the suite).
describe('supabase-storage: auth guard', () => {
  it('save() while unauthenticated rejects', async () => {
    __reset();
    __setUnauthenticated();
    const s = createSupabaseStorage();
    await expect(
      s.save('x', { id: 'x', name: 'X', courses: [] })
    ).rejects.toThrow(/not authenticated/i);
  });
});

// Beyond the contract: cloud write-conflict detection (Phase 12.1).
describe('supabase-storage: conflict detection', () => {
  const v1 = { id: 'c', name: 'C', courses: [] };
  const v2 = { id: 'c', name: 'C edited here', courses: [] };

  it('save() rejects with ConflictError when the row changed on another device', async () => {
    __reset();
    const s = createSupabaseStorage();
    await s.save('c', v1); // baseline written
    await s.get('c'); // observe current updated_at
    // Another device writes: bump the row's updated_at out-of-band.
    __setUpdatedAt('c', '2999-01-01T00:00:00.000Z');

    const err = await s.save('c', v2).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ConflictError');
    expect(err.code).toBe('CONFLICT');
    expect(err.semesterId).toBe('c');
    expect(err.actualUpdatedAt).toBe('2999-01-01T00:00:00.000Z');
    // .remote is the bumped remote blob (migrated), for the "load latest" path.
    expect(err.remote?.name).toBe('C');
    expect(Array.isArray(err.remote?.readingTags)).toBe(true);
  });

  it('save() succeeds across repeated saves with no external change, even '
     + 'though the server stamps its own updated_at on every write (regression '
     + 'for the "changed on another device on every save" bug)', async () => {
    __reset();
    const s = createSupabaseStorage();
    await expect(s.save('c', v1)).resolves.toEqual({ ok: true, id: 'c' });
    await expect(s.save('c', v2)).resolves.toEqual({ ok: true, id: 'c' });
    await expect(s.save('c', v1)).resolves.toEqual({ ok: true, id: 'c' });
  });
});
