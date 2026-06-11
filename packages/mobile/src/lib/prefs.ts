// Device-local UI preferences (last-opened semester, study mode, sort order,
// tutorial-seen) backed by AsyncStorage. Mirrors the desktop renderer's
// readPref/writePref semantics: reads never throw (fallback on error) and
// writes fail silently. This is UI state only — it must never be written into
// the semester JSON or Supabase.
import AsyncStorage from '@react-native-async-storage/async-storage';

const K = {
  lastSemesterId: 'lectio:pref:lastSemesterId',
  studyMode: 'lectio:pref:studyMode',
  sortOrder: 'lectio:pref:sortOrder',
  tutorialSeen: 'lectio:pref:tutorialSeen',
} as const;

async function getString(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function setString(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    /* storage unavailable — ignore, not user-facing */
  }
}

async function remove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    /* storage unavailable — ignore, not user-facing */
  }
}

export const prefs = {
  // last-opened semester
  getLastSemesterId: () => getString(K.lastSemesterId),
  setLastSemesterId: (id: string) => setString(K.lastSemesterId, id),
  clearLastSemesterId: () => remove(K.lastSemesterId),

  // study mode (boolean)
  getStudyMode: async () => (await getString(K.studyMode)) === 'true',
  setStudyMode: (on: boolean) => setString(K.studyMode, on ? 'true' : 'false'),

  // sort order (validated by the caller against core SORT_ORDERS)
  getSortOrder: () => getString(K.sortOrder),
  setSortOrder: (order: string) => setString(K.sortOrder, order),

  // tutorial seen (boolean)
  getTutorialSeen: async () => (await getString(K.tutorialSeen)) === 'true',
  setTutorialSeen: (seen: boolean) => setString(K.tutorialSeen, seen ? 'true' : 'false'),
};
