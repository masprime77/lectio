// Hand-written types for @lectio/core (which ships as plain JS, untyped).
//
// @lectio/core resolves to a real symlinked JS file in this workspace, so a
// plain ambient `declare module` gets shadowed by that resolution. Instead this
// file is a normal declaration *module*, and tsconfig.json maps the core import
// specifiers to it via `paths` (see "@lectio/core*"). One file backs every
// subpath the app imports — `@lectio/core`, `@lectio/core/planner-core`,
// `@lectio/core/pomodoro-core`, `@lectio/core/storage/migrate`,
// `@lectio/core/storage/contract`, `@lectio/core/integrations/lectio-file`. It deliberately omits the Node-only
// subpaths (`semester-store`, `ipc-handlers`, `storage/fs`) so they stay
// unimportable from the RN bundle.

// ---------------------------------------------------------------------------
// Data shapes (mirrors planner-core + the storage contract)
// ---------------------------------------------------------------------------

export type TagSection = 'pending' | 'done';

export interface Tag {
  id: string;
  name: string;
  color: string;
  section: TagSection;
}

/** A reading or task. `status` is a tag id (or '__deleted__' for a ghost). */
export interface PlannerItem {
  id?: string;
  week?: number;
  title?: string;
  dueDate?: string;
  /** Capped free-text note; absent or '' means no note. See MAX_NOTE_LENGTH. */
  note?: string;
  status: string;
  _ghostSection?: TagSection;
  [k: string]: unknown;
}

export type ReadingItem = PlannerItem;
export type TaskItem = PlannerItem;

export interface Course {
  id: string;
  name: string;
  color?: string;
  /** 'YYYY-MM-DD', or '' / absent for no exam date set. */
  examDate?: string;
  readings: ReadingItem[];
  tasks: TaskItem[];
  /** Present only once time has been logged; see @lectio/core/pomodoro-core. */
  studyTime?: StudyTime;
}

export interface Semester {
  id: string;
  name: string;
  startDate?: string;
  weeks?: number;
  courses: Course[];
  readingTags?: Tag[];
  taskTags?: Tag[];
  /**
   * Time studied with no course attached — its own category in the study-time
   * breakdown. Present only once free study has been logged.
   */
  freeStudy?: StudyTime;
}

export interface SemesterSummary {
  id: string;
  name: string;
}

/** The async storage contract every platform adapter satisfies. */
export interface Storage {
  list(): Promise<SemesterSummary[]>;
  get(id: string): Promise<Semester>;
  save(id: string, data: Semester): Promise<{ ok: true; id: string }>;
  delete(id: string): Promise<{ ok: true; id: string }>;
}

// ---------------------------------------------------------------------------
// planner-core surface (the "." and "./planner-core" exports)
// ---------------------------------------------------------------------------

export const DEFAULT_READING_TAGS: Tag[];
export const DEFAULT_TASK_TAGS: Tag[];
export const PROTECTED_TAG_IDS: Set<string>;
export function isProtectedTag(id: string): boolean;
export function getReadingTags(semester: Semester): Tag[];
export function getTaskTags(semester: Semester): Tag[];
export function addTag(
  semester: Semester,
  type: 'reading' | 'task',
  tag: { name: string; color: string; section: TagSection }
): Tag;
export function editTag(
  semester: Semester,
  type: 'reading' | 'task',
  tagId: string,
  patch: { name?: string; color?: string }
): boolean;
export function deleteTag(
  semester: Semester,
  type: 'reading' | 'task',
  tagId: string
): boolean;
export function reorderTags(
  semester: Semester,
  type: 'reading' | 'task',
  orderedIds: string[]
): void;
export function getCourses(semester: Semester): Course[];
export function courseProgress(course: Course, semester: Semester): number;
export interface CourseBreakdown {
  readings: { done: number; total: number };
  tasks: { done: number; total: number };
}
export type SortOrder =
  | 'progress-asc'
  | 'progress-desc'
  | 'alpha-asc'
  | 'week-asc'
  | 'week-desc'
  | 'exam-asc';
export const SORT_ORDERS: SortOrder[];
/** Character cap for PlannerItem.note. Enforce this live in any note input. */
export const MAX_NOTE_LENGTH: number;
export function courseBreakdown(course: Course, semester: Semester): CourseBreakdown;
export function sortedCourses(
  courses: Course[],
  semester: Semester,
  sortOrder: SortOrder
): Course[];
export function setItemStatus(
  course: Course,
  kind: 'reading' | 'task',
  itemId: string,
  tagId: string
): PlannerItem | null;
export function uid(prefix: string): string;
export function addCourse(
  semester: Semester,
  course: { name: string; color?: string; examDate?: string }
): Course;
export function deleteCourse(semester: Semester, courseId: string): boolean;
export function editCourseName(
  semester: Semester,
  courseId: string,
  name: string
): Course | null;
export function editCourseColor(
  semester: Semester,
  courseId: string,
  color: string
): Course | null;
export function editCourseExamDate(
  semester: Semester,
  courseId: string,
  examDate: string
): Course | null;
export function reorderCourses(semester: Semester, orderedIds: string[]): void;
export function addItem(
  course: Course,
  kind: 'reading' | 'task',
  item: { title: string; week: number; dueDate?: string; note?: string }
): PlannerItem;
export function editItem(
  course: Course,
  kind: 'reading' | 'task',
  itemId: string,
  patch: { title?: string; week?: number; dueDate?: string; note?: string }
): PlannerItem | null;
export function deleteItem(
  course: Course,
  kind: 'reading' | 'task',
  itemId: string
): boolean;
/**
 * Move an item between `course.readings` and `course.tasks`. Returns the moved
 * item, or null when the id is unknown or it already is that kind.
 */
export function convertItemKind(
  course: Course,
  itemId: string,
  toKind: 'reading' | 'task'
): PlannerItem | null;

// ---------------------------------------------------------------------------
// storage/migrate and storage/contract surfaces
// ---------------------------------------------------------------------------

export function migrateStatusToTagId(semester: Semester): Semester;

export const STORAGE_METHODS: string[];
export function assertStorage<T>(impl: T): T;

// ---------------------------------------------------------------------------
// storage/conflict surface (cloud write-conflict detection)
// ---------------------------------------------------------------------------

/** Thrown by a cloud adapter's save() when the row changed on another device. */
export class ConflictError extends Error {
  code: 'CONFLICT';
  semesterId: string;
  expectedUpdatedAt: string | null;
  actualUpdatedAt: string | null;
  remote: Semester | null;
  constructor(
    id: string,
    opts?: {
      expectedUpdatedAt?: string | null;
      actualUpdatedAt?: string | null;
      remote?: Semester | null;
    }
  );
}
export function detectConflict(
  expected: string | null,
  actual: string | null
): boolean;

// ---------------------------------------------------------------------------
// integrations/lectio-file surface (the `.lectio.json` interchange helpers)
// ---------------------------------------------------------------------------

export interface LectioSemesterFile {
  _lectioType: 'semester';
  _version: number;
  semester: Semester;
}
export interface LectioCourseFile {
  _lectioType: 'course';
  _version: number;
  course: Course;
}

export const LECTIO_FILE_VERSION: number;
export function buildSemesterFile(semester: Semester): LectioSemesterFile;
export function buildCourseFile(course: Course): LectioCourseFile;
export function cleanCourse(course: Course): Course;
export function parseSemesterFile(payload: unknown): Semester;
export function parseCourseFile(payload: unknown): Course;
export function withResetStatuses(semester: Semester): Semester;
export function withResetCourseItems(course: Course): Course;
export function slugify(s: string): string;
export function uniqueSemesterId(
  name: string,
  existingIds?: string[] | Set<string>
): string;
export function prepareImportedCourse(
  course: Course,
  makeId?: (prefix: string) => string
): Course;

// ---------------------------------------------------------------------------
// integrations/moodle-client surface (the Moodle Web Services REST client)
// ---------------------------------------------------------------------------

export interface MoodleSiteInfo {
  userid: number;
  fullname?: string;
  username?: string;
  [k: string]: unknown;
}

export interface MoodleCourse {
  id: number;
  fullname?: string;
  shortname?: string;
  [k: string]: unknown;
}

export class MoodleApiError extends Error {
  errorcode?: string;
  wsfunction?: string;
}

export function createMoodleClient(config: {
  baseUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
}): {
  getSiteInfo(): Promise<MoodleSiteInfo>;
  getEnrolledCourses(userId: number): Promise<MoodleCourse[]>;
  getCourseContents(courseId: number): Promise<MoodleSection[]>;
};

// ---------------------------------------------------------------------------
// integrations/moodle surface (the pure Moodle content mapper)
// ---------------------------------------------------------------------------

export interface MoodleModule {
  id: number;
  name: string;
  modname: string;
  url?: string;
  visible?: number;
  uservisible?: boolean;
  [k: string]: unknown;
}

export interface MoodleSection {
  section: number;
  name: string;
  visible?: number;
  uservisible?: boolean;
  modules: MoodleModule[];
  [k: string]: unknown;
}

export interface MoodleMappedItem {
  name: string;
  url?: string;
  moodleModuleId: number;
  moodleSource?: string;
}

export interface MoodleDateRange {
  startDay: number;
  startMonth: number;
  endDay: number;
  endMonth: number;
}

export interface MoodleWeek {
  moodleSection: number;
  sectionName: string;
  dateRange: MoodleDateRange | null;
  items: MoodleMappedItem[];
}

export interface MoodleMappedContent {
  weeks: MoodleWeek[];
}

export function isModuleImportable(mod: MoodleModule): boolean;
export function isSectionVisible(section: MoodleSection): boolean;
export function mapModuleToItem(mod: MoodleModule, source?: string): MoodleMappedItem;
export function parseGermanDateRangeSectionName(name: string): MoodleDateRange | null;
export function mapCourseContents(
  sections: MoodleSection[],
  options?: { includeEmptyWeeks?: boolean; source?: string }
): MoodleMappedContent;

// planner-core's "." export is a CommonJS object; expose it as a default too.
declare const core: {
  DEFAULT_READING_TAGS: Tag[];
  DEFAULT_TASK_TAGS: Tag[];
  getReadingTags(semester: Semester): Tag[];
  getTaskTags(semester: Semester): Tag[];
  getCourses(semester: Semester): Course[];
  courseProgress(course: Course, semester: Semester): number;
  uid(prefix: string): string;
};
export default core;

// ---------------------------------------------------------------------------
// Pomodoro timer + study time (@lectio/core/pomodoro-core)
// ---------------------------------------------------------------------------

export interface PomodoroSettings {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  pomodorosUntilLongBreak: number;
}

export type PomodoroPhase = 'idle' | 'work' | 'shortBreak' | 'longBreak';

/** Deadline-based session state; JSON-safe, so it persists as-is. */
export interface PomodoroSession {
  phase: PomodoroPhase;
  endsAt: number;
  pausedAt: number | null;
  completedPomodoros: number;
  /** True once the phase has run out and the user has not confirmed moving on. */
  awaitingAdvance: boolean;
  /**
   * Epoch ms when the user chose to carry a finished phase on open-ended
   * ("Extra focus" / "Extra break"), or null. While set the phase counts up
   * with no deadline, and for a work phase it marks the start of the
   * not-yet-credited stretch.
   */
  overtimeStartedAt: number | null;
  courseId: string | null;
  semesterId: string | null;
}

export interface StudySession {
  id: string;
  seconds: number;
  source: 'pomodoro' | 'manual' | 'adjustment';
  date: string;
  createdAt: string;
}

export interface StudyTime {
  totalSeconds: number;
  sessions: StudySession[];
}

/** One category's slice of a semester's tracked study time. */
export interface StudyTimeSlice {
  id: string;
  name: string;
  color: string | null;
  /** True for the semester-level free-study slice, false for a course. */
  freeStudy: boolean;
  seconds: number;
  /** Exact fraction of totalSeconds, 0..1. */
  share: number;
  /** `share` as a whole number; rounded per slice, so these may total 99/101. */
  percent: number;
}

export interface StudyTimeBreakdown {
  totalSeconds: number;
  /**
   * Most-studied first; categories with no tracked time are omitted. Includes
   * the free-study slice (id FREE_STUDY_ID) alongside the courses.
   */
  courses: StudyTimeSlice[];
}

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings;
export const MAX_SESSIONS: number;
export const MAX_OVERTIME_SECONDS: number;
export const FREE_STUDY_ID: string;
export const FREE_STUDY_NAME: string;
export const FREE_STUDY_COLOR: string;
export function clampPomodoroSettings(
  settings: Partial<PomodoroSettings> | null | undefined
): PomodoroSettings;

export function createIdleSession(): PomodoroSession;
export function phaseDurationSeconds(phase: PomodoroPhase, settings: PomodoroSettings): number;
export function startSession(
  settings: PomodoroSettings,
  opts: { courseId?: string | null; semesterId?: string | null },
  nowMs?: number
): PomodoroSession;
export function remainingSeconds(session: PomodoroSession, nowMs?: number): number;
export function isRunning(session: PomodoroSession): boolean;
export function isPaused(session: PomodoroSession): boolean;
export function isPhaseComplete(session: PomodoroSession, nowMs?: number): boolean;
export function isAwaitingAdvance(session: PomodoroSession): boolean;
export function isOvertime(session: PomodoroSession): boolean;
export function overtimeSeconds(session: PomodoroSession, nowMs?: number): number;
export function markPhaseComplete(session: PomodoroSession, nowMs?: number): PomodoroSession;
export function extendPhase(session: PomodoroSession, nowMs?: number): PomodoroSession;
export function extendPhaseByMinutes(
  session: PomodoroSession,
  minutes: number,
  nowMs?: number
): PomodoroSession;
export function pauseSession(session: PomodoroSession, nowMs?: number): PomodoroSession;
export function resumeSession(session: PomodoroSession, nowMs?: number): PomodoroSession;
export function elapsedWorkSeconds(
  session: PomodoroSession,
  settings: PomodoroSettings,
  nowMs?: number
): number;
/** Studied seconds the current work phase still owes; 0 outside a work phase. */
export function pendingWorkCreditSeconds(
  session: PomodoroSession,
  settings: PomodoroSettings,
  nowMs?: number
): number;
export function advanceSession(
  session: PomodoroSession,
  settings: PomodoroSettings,
  nowMs?: number
): PomodoroSession;
export function skipPhase(
  session: PomodoroSession,
  settings: PomodoroSettings,
  nowMs?: number
): PomodoroSession;
export function confirmAdvance(
  session: PomodoroSession,
  settings: PomodoroSettings,
  nowMs?: number
): PomodoroSession;
export function phaseLabel(phase: PomodoroPhase): string;
/** Phase label that reads "Extra focus"/"Extra break" while open-ended. */
export function sessionLabel(session: PomodoroSession): string;
export function rehydrateSession(raw: unknown, nowMs?: number): PomodoroSession;

export function ensureStudyTime(course: Course): StudyTime;
export function ensureFreeStudyTime(semester: Semester): StudyTime;
export function getCourseStudySeconds(course: Course): number;
export function getFreeStudySeconds(semester: Semester | null | undefined): number;
export function studyTimeByCourse(semester: Semester | null | undefined): StudyTimeBreakdown;
export function addStudyTime(
  course: Course,
  seconds: number,
  opts?: { source?: StudySession['source']; date?: string }
): Course;
export function addFreeStudyTime(
  semester: Semester,
  seconds: number,
  opts?: { source?: StudySession['source']; date?: string }
): Semester;
export function setStudyTime(course: Course, newTotalSeconds: number): Course;
export function setFreeStudyTime(semester: Semester, newTotalSeconds: number): Semester;
export function formatClock(totalSeconds: number): string;
export function formatHoursMinutes(totalSeconds: number): string;
export function parseHoursMinutesInput(text: string): number | null;

// --- Stopwatch -------------------------------------------------------------
// The count-up timer. Unlike a pomodoro session it does not know what it
// credits until it is stopped, so it carries no courseId.

export interface Stopwatch {
  /** Epoch ms the current run began, or null while paused. */
  runningSince: number | null;
  /** Seconds accumulated by earlier runs of this stopwatch. */
  bankedSeconds: number;
  /** Local date key of the first start — the day the time is credited to. */
  startedDate: string | null;
  semesterId: string | null;
}

export const MAX_STOPWATCH_SECONDS: number;
export function createIdleStopwatch(): Stopwatch;
export function isStopwatchRunning(sw: Stopwatch | null | undefined): boolean;
export function isStopwatchPaused(sw: Stopwatch | null | undefined): boolean;
export function isStopwatchIdle(sw: Stopwatch | null | undefined): boolean;
export function stopwatchSeconds(sw: Stopwatch | null | undefined, nowMs?: number): number;
export function startStopwatch(
  opts: { semesterId?: string | null },
  nowMs?: number
): Stopwatch;
export function pauseStopwatch(sw: Stopwatch, nowMs?: number): Stopwatch;
export function resumeStopwatch(sw: Stopwatch, nowMs?: number): Stopwatch;
export function resetStopwatch(): Stopwatch;
export function rehydrateStopwatch(raw: unknown): Stopwatch;

// --- Local calendar keys, ranges and the session log ------------------------
// Dates are 'YYYY-MM-DD' in the *user's own* timezone, never a UTC slice.

/** Monday — study weeks match the planner's, which start on a Monday. */
export const WEEK_START_DAY: number;
/** How many calendar weeks of per-session detail are kept (current + 3 back). */
export const STUDY_LOG_WEEKS: number;

export interface StudyDateRange {
  from: string;
  to: string;
}

export function localDateKey(value?: Date | number): string;
export function isValidDateKey(key: unknown): boolean;
export function dateKeyToDate(key: string): Date | null;
export function addDaysToKey(key: string, days: number): string | null;
export function weekStartKey(key: string): string | null;
export function dateKeysBetween(fromKey: string, toKey: string): string[];
/** 0 is today, -1 yesterday. */
export function studyDayRange(dayOffset: number, nowMs?: number): StudyDateRange;
/** 0 is the current week, -1 the previous one. */
export function studyWeekRange(weekOffset: number, nowMs?: number): StudyDateRange;
export function studyLogCutoffKey(nowMs?: number, weeksKept?: number): string;

/**
 * Where the time studied between two dates (inclusive) went — the ranged
 * counterpart of studyTimeByCourse, in the same shape. Built from the session
 * log rather than the running totals, and excludes 'adjustment' entries, which
 * correct the all-time total rather than record time studied at a moment.
 */
export function studyTimeInRange(
  semester: Semester | null | undefined,
  fromKey: string,
  toKey: string
): StudyTimeBreakdown;
/** One gap-filled entry per day in the range. */
export function studyTimeByDay(
  semester: Semester | null | undefined,
  fromKey: string,
  toKey: string
): { date: string; totalSeconds: number }[];
/**
 * Drops session entries older than the kept window, in place. `totalSeconds` is
 * never touched, so the all-time view keeps every hour. Returns how many
 * entries were removed.
 */
export function pruneStudySessions(
  semester: Semester | null | undefined,
  nowMs?: number,
  weeksKept?: number
): number;
