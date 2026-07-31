import * as SecureStore from 'expo-secure-store';

// Secure, on-device storage for a single Moodle connection's token. Exactly
// one connection at a time for now (no multi-account storage yet — matches
// desktop Part B's scope). Mirrors desktop's getMoodleToken/setMoodleToken/
// clearMoodleToken naming and shape for consistency across platforms.
const KEY = 'lectio-moodle-token';

export interface MoodleTokenRecord {
  baseUrl: string;
  wstoken: string;
}

export async function getMoodleToken(): Promise<MoodleTokenRecord | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  return JSON.parse(raw) as MoodleTokenRecord;
}

export async function setMoodleToken(record: MoodleTokenRecord): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(record));
}

export async function clearMoodleToken(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
