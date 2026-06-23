import { describe, it, expect, vi } from 'vitest';

// Redirect the adapter's `import { supabase } from '../supabase/client'` to the
// in-memory fake. We mock by the adapter's resolved module (test-relative
// `../src/supabase/client` resolves to the same absolute file the adapter's own
// `../supabase/client` does), so both share one fake instance. A config alias by
// absolute path can't intercept a relative specifier, hence vi.mock here.
vi.mock('../src/supabase/client', () => import('./mocks/supabase-client'));

import { __reset, __setUnauthenticated } from './mocks/supabase-client';
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
