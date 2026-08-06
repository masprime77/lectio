import * as SecureStore from 'expo-secure-store';

// Secure, on-device storage for several Moodle connections' tokens — one
// entry per Moodle instance, keyed by baseUrl. Mirrors desktop's
// listMoodleAccounts/getMoodleAccountToken/addMoodleAccount/
// removeMoodleAccount naming, shape, and migration behaviour so the two
// platforms read alike (see main.js's Moodle section).
//
// All accounts live under ONE SecureStore key, holding the same
// { accounts: [...] } record desktop writes to its encrypted file, rather
// than a key per account: SecureStore keys are restricted to
// [A-Za-z0-9._-], so per-baseUrl keys would need an encoding scheme, and
// there'd be no way to enumerate them. The tradeoff is Android's ~2048-byte
// guidance for a single SecureStore value — ample for the handful of
// instances one person is enrolled at (~130 bytes per account), but not a
// design that would scale to dozens.
const KEY = 'lectio-moodle-token';

export interface MoodleAccountRecord {
  baseUrl: string;
  wstoken: string;
  label?: string;
}

// An account WITHOUT its wstoken — what listMoodleAccounts hands back for
// display. Unlike desktop this doesn't cross a process boundary, so it's
// hygiene (a token can't leak into a log or a rendered list by accident)
// rather than isolation.
export type MoodleAccountSummary = Omit<MoodleAccountRecord, 'wstoken'>;

interface MoodleAccountsRecord {
  accounts: MoodleAccountRecord[];
}

// Reads the stored record, transparently migrating the old single-account
// shape ({ baseUrl, wstoken }) to { accounts: [...] } in memory. The
// migrated shape is NOT written back until the next mutation
// (addMoodleAccount / removeMoodleAccount) — a read-only call never
// rewrites the stored value.
async function readAccounts(): Promise<MoodleAccountsRecord> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return { accounts: [] };
  const data = JSON.parse(raw) as Partial<MoodleAccountsRecord> & Partial<MoodleAccountRecord>;
  if (Array.isArray(data.accounts)) return { accounts: data.accounts };
  // Old single-account shape.
  if (data.baseUrl && data.wstoken) {
    return { accounts: [{ baseUrl: data.baseUrl, wstoken: data.wstoken }] };
  }
  return { accounts: [] };
}

async function writeAccounts(data: MoodleAccountsRecord): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(data));
}

export async function listMoodleAccounts(): Promise<MoodleAccountSummary[]> {
  const { accounts } = await readAccounts();
  return accounts.map(({ baseUrl, label }) => ({ baseUrl, label }));
}

// One account's full record (including wstoken), by baseUrl — the on-demand
// counterpart to the token-free listing, for building a Moodle client.
export async function getMoodleAccountToken(baseUrl: string): Promise<MoodleAccountRecord | null> {
  const { accounts } = await readAccounts();
  return accounts.find((a) => a.baseUrl === baseUrl) ?? null;
}

// Adds a new account, or replaces an existing one with the same baseUrl (a
// reconnect after an expired/invalid token) — exactly one entry per baseUrl.
export async function addMoodleAccount(record: MoodleAccountRecord): Promise<void> {
  const data = await readAccounts();
  const idx = data.accounts.findIndex((a) => a.baseUrl === record.baseUrl);
  if (idx === -1) data.accounts.push(record);
  else data.accounts[idx] = record;
  await writeAccounts(data);
}

export async function removeMoodleAccount(baseUrl: string): Promise<void> {
  const { accounts } = await readAccounts();
  await writeAccounts({ accounts: accounts.filter((a) => a.baseUrl !== baseUrl) });
}
