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
