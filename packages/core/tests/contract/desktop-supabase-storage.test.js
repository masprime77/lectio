import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { createFakeClient } from './fake-supabase-client.js';
import { assertStorage } from '../../src/storage/contract.js';
import { runStorageContract } from './storage-contract.js';

// The desktop adapter is a dual-mode CommonJS file (it attaches window globals in
// the renderer and module.exports in Node). createRequire loads its Node face
// cleanly; createSupabaseStorage(client) takes the Supabase client by injection,
// so we pass the in-memory fake — the same surface the renderer's
// window.lectioSupabase satisfies.
const require = createRequire(import.meta.url);
const createSupabaseStorage = require('../../../desktop/supabase-storage.js');

// Each factory call must yield empty, authenticated storage (a fresh fake client).
function makeEmptyStorage() {
  return createSupabaseStorage(createFakeClient());
}

// adapter shape check
assertStorage(makeEmptyStorage());

// full contract (six cases) — must pass UNCHANGED, like fs/device/mobile.
runStorageContract('desktop-supabase-storage', makeEmptyStorage);

// Beyond the contract: the adapter's auth guard (not exercised by the suite).
describe('desktop-supabase-storage: auth guard', () => {
  it('save() while unauthenticated rejects', async () => {
    const client = createFakeClient();
    client.__setUnauthenticated();
    const s = createSupabaseStorage(client);
    await expect(
      s.save('x', { id: 'x', name: 'X', courses: [] })
    ).rejects.toThrow(/not authenticated/i);
  });
});

// Beyond the contract: cloud write-conflict detection (Phase 12.1).
describe('desktop-supabase-storage: conflict detection', () => {
  const v1 = { id: 'c', name: 'C', courses: [] };
  const v2 = { id: 'c', name: 'C edited here', courses: [] };

  it('save() rejects with ConflictError when the row changed on another device', async () => {
    const client = createFakeClient();
    const s = createSupabaseStorage(client);
    await s.save('c', v1); // baseline written
    await s.get('c'); // observe current updated_at
    // Another device writes: bump the row's updated_at out-of-band.
    client.__setUpdatedAt('c', '2999-01-01T00:00:00.000Z');

    const err = await s.save('c', v2).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ConflictError');
    expect(err.code).toBe('CONFLICT');
    expect(err.semesterId).toBe('c');
    expect(err.actualUpdatedAt).toBe('2999-01-01T00:00:00.000Z');
    // .remote is the bumped remote blob (migrated), for the "load latest" path.
    expect(err.remote.name).toBe('C');
    expect(Array.isArray(err.remote.readingTags)).toBe(true);
  });

  it('save() succeeds and advances the baseline when there is no external change', async () => {
    const client = createFakeClient();
    const s = createSupabaseStorage(client);
    await s.save('c', v1);
    await s.get('c');
    await expect(s.save('c', v2)).resolves.toEqual({ ok: true, id: 'c' });
    // Baseline advanced, so an immediate second save also succeeds.
    await expect(s.save('c', v1)).resolves.toEqual({ ok: true, id: 'c' });
  });
});
