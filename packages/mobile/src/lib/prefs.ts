// Device-local UI preferences (last-opened semester, sort order, course
// grouping, tutorial-seen, pomodoro durations + live session) backed by
// AsyncStorage. Mirrors the desktop renderer's
// readPref/writePref semantics: reads never throw (fallback on error) and
// writes fail silently. This is UI state only — it must never be written into
// the semester JSON or Supabase.
import AsyncStorage from '@react-native-async-storage/async-storage';

const K = {
  lastSemesterId: 'lectio:pref:lastSemesterId',
  sortOrder: 'lectio:pref:sortOrder',
  tutorialSeen: 'lectio:pref:tutorialSeen',
  pomodoroSettings: 'lectio:pref:pomodoroSettings',
  pomodoroSession: 'lectio:pref:pomodoroSession',
  openCourseWeeks: 'lectio:pref:openCourseWeeks',
  courseGrouping: 'lectio:pref:courseGrouping',
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

  // sort order (validated by the caller against core SORT_ORDERS)
  getSortOrder: () => getString(K.sortOrder),
  setSortOrder: (order: string) => setString(K.sortOrder, order),

  // tutorial seen (boolean)
  getTutorialSeen: async () => (await getString(K.tutorialSeen)) === 'true',
  setTutorialSeen: (seen: boolean) => setString(K.tutorialSeen, seen ? 'true' : 'false'),

  // pomodoro durations + live session (device-local UI state, JSON blobs).
  // Both are parsed defensively by the caller via core's clamp/rehydrate.
  getPomodoroSettings: () => getString(K.pomodoroSettings),
  setPomodoroSettings: (json: string) => setString(K.pomodoroSettings, json),
  getPomodoroSession: () => getString(K.pomodoroSession),
  setPomodoroSession: (json: string) => setString(K.pomodoroSession, json),
  clearPomodoroSession: () => remove(K.pomodoroSession),

  // Which week sections are expanded on the course detail screen, as a JSON
  // map keyed by "<courseId>:<kind>:<week>". Only the sections the user has
  // actually toggled are stored; everything else falls back to the default
  // (the current week open). Parsed defensively by the caller.
  getOpenCourseWeeks: () => getString(K.openCourseWeeks),
  setOpenCourseWeeks: (json: string) => setString(K.openCourseWeeks, json),

  // How the course detail screen groups its items ('week' | 'type'), validated
  // by the caller like the sort order is. One choice for every course, matching
  // the desktop's single persisted grouping mode.
  getCourseGrouping: () => getString(K.courseGrouping),
  setCourseGrouping: (mode: string) => setString(K.courseGrouping, mode),
};
