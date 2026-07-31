import { describe, it, expect, beforeEach } from 'vitest';
import * as SecureStoreMock from './mocks/expo-secure-store';
import { getMoodleToken, setMoodleToken, clearMoodleToken } from '../src/auth/moodle-token-store';

beforeEach(() => {
  SecureStoreMock.__reset();
});

describe('moodle-token-store', () => {
  it('returns null when nothing is stored', async () => {
    expect(await getMoodleToken()).toBeNull();
  });

  it('round-trips a stored token', async () => {
    await setMoodleToken({ baseUrl: 'https://moodle.example', wstoken: 'abc123' });
    expect(await getMoodleToken()).toEqual({ baseUrl: 'https://moodle.example', wstoken: 'abc123' });
  });

  it('clears a stored token', async () => {
    await setMoodleToken({ baseUrl: 'https://moodle.example', wstoken: 'abc123' });
    await clearMoodleToken();
    expect(await getMoodleToken()).toBeNull();
  });

  it('overwrites a previous token on re-set (single connection only)', async () => {
    await setMoodleToken({ baseUrl: 'https://a.example', wstoken: 'one' });
    await setMoodleToken({ baseUrl: 'https://b.example', wstoken: 'two' });
    expect(await getMoodleToken()).toEqual({ baseUrl: 'https://b.example', wstoken: 'two' });
  });
});
