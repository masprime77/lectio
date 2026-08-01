import { describe, it, expect, beforeEach } from 'vitest';
import * as SecureStoreMock from './mocks/expo-secure-store';
import {
  listMoodleAccounts,
  getMoodleAccountToken,
  addMoodleAccount,
  removeMoodleAccount,
} from '../src/auth/moodle-token-store';

// The store's own SecureStore key, duplicated here on purpose: these tests
// seed and inspect the raw stored value, and pinning the literal means a
// rename that would strand existing installs' tokens fails a test.
const KEY = 'lectio-moodle-token';

const stored = async () => JSON.parse((await SecureStoreMock.getItemAsync(KEY))!);

beforeEach(() => {
  SecureStoreMock.__reset();
});

describe('moodle-token-store', () => {
  it('returns an empty list when nothing is stored', async () => {
    expect(await listMoodleAccounts()).toEqual([]);
  });

  it('returns null for an unknown account when nothing is stored', async () => {
    expect(await getMoodleAccountToken('https://moodle.example')).toBeNull();
  });

  it('holds several accounts at once', async () => {
    await addMoodleAccount({ baseUrl: 'https://a.example', wstoken: 'tok-a', label: 'Account A' });
    await addMoodleAccount({ baseUrl: 'https://b.example', wstoken: 'tok-b', label: 'Account B' });

    expect(await listMoodleAccounts()).toEqual([
      { baseUrl: 'https://a.example', label: 'Account A' },
      { baseUrl: 'https://b.example', label: 'Account B' },
    ]);
  });

  it('omits the wstoken from listed accounts', async () => {
    await addMoodleAccount({ baseUrl: 'https://a.example', wstoken: 'tok-a', label: 'Account A' });

    for (const account of await listMoodleAccounts()) {
      expect(account).not.toHaveProperty('wstoken');
    }
  });

  it('returns one account\'s full record by baseUrl', async () => {
    await addMoodleAccount({ baseUrl: 'https://a.example', wstoken: 'tok-a', label: 'Account A' });
    await addMoodleAccount({ baseUrl: 'https://b.example', wstoken: 'tok-b', label: 'Account B' });

    expect(await getMoodleAccountToken('https://a.example')).toEqual({
      baseUrl: 'https://a.example',
      wstoken: 'tok-a',
      label: 'Account A',
    });
  });

  it('returns null for a baseUrl that is not connected', async () => {
    await addMoodleAccount({ baseUrl: 'https://a.example', wstoken: 'tok-a' });

    expect(await getMoodleAccountToken('https://nope.example')).toBeNull();
  });

  it('replaces an existing account in place on reconnect', async () => {
    await addMoodleAccount({ baseUrl: 'https://a.example', wstoken: 'tok-a', label: 'Account A' });
    await addMoodleAccount({ baseUrl: 'https://b.example', wstoken: 'tok-b', label: 'Account B' });
    await addMoodleAccount({ baseUrl: 'https://b.example', wstoken: 'tok-b2', label: 'Account B renamed' });

    expect(await listMoodleAccounts()).toHaveLength(2);
    expect(await getMoodleAccountToken('https://b.example')).toEqual({
      baseUrl: 'https://b.example',
      wstoken: 'tok-b2',
      label: 'Account B renamed',
    });
  });

  it('removes one account and leaves the others', async () => {
    await addMoodleAccount({ baseUrl: 'https://a.example', wstoken: 'tok-a', label: 'Account A' });
    await addMoodleAccount({ baseUrl: 'https://b.example', wstoken: 'tok-b', label: 'Account B' });
    await removeMoodleAccount('https://a.example');

    expect(await listMoodleAccounts()).toEqual([{ baseUrl: 'https://b.example', label: 'Account B' }]);
    expect(await getMoodleAccountToken('https://a.example')).toBeNull();
  });

  it('ignores a removal of an account that is not connected', async () => {
    await addMoodleAccount({ baseUrl: 'https://a.example', wstoken: 'tok-a', label: 'Account A' });
    await removeMoodleAccount('https://nope.example');

    expect(await listMoodleAccounts()).toEqual([{ baseUrl: 'https://a.example', label: 'Account A' }]);
  });

  it('falls back to an empty list for an unrecognised stored payload', async () => {
    await SecureStoreMock.setItemAsync(KEY, JSON.stringify({ something: 'else' }));

    expect(await listMoodleAccounts()).toEqual([]);
  });

  describe('migration from the single-account shape', () => {
    const legacy = { baseUrl: 'https://old.example', wstoken: 'tok-old' };

    beforeEach(async () => {
      await SecureStoreMock.setItemAsync(KEY, JSON.stringify(legacy));
    });

    it('surfaces a legacy token as a one-item list', async () => {
      expect(await listMoodleAccounts()).toEqual([{ baseUrl: 'https://old.example' }]);
    });

    it('looks a legacy token up by its baseUrl', async () => {
      expect(await getMoodleAccountToken('https://old.example')).toEqual(legacy);
    });

    it('does not rewrite the stored value on a read', async () => {
      await listMoodleAccounts();
      await getMoodleAccountToken('https://old.example');

      expect(await stored()).toEqual(legacy);
    });

    it('rewrites to the new shape on the first mutation, keeping the legacy token', async () => {
      await addMoodleAccount({ baseUrl: 'https://new.example', wstoken: 'tok-new', label: 'New' });

      expect(await stored()).toEqual({
        accounts: [legacy, { baseUrl: 'https://new.example', wstoken: 'tok-new', label: 'New' }],
      });
    });
  });
});
