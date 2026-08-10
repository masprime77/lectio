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
  | 'week-desc';
export const SORT_ORDERS: SortOrder[];
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
  course: { name: string; color?: string }
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
export function reorderCourses(semester: Semester, orderedIds: string[]): void;
export function addItem(
  course: Course,
  kind: 'reading' | 'task',
  item: { title: string; week: number; dueDate?: string }
): PlannerItem;
export function editItem(
  course: Course,
  kind: 'reading' | 'task',
  itemId: string,
  patch: { title?: string; week?: number; dueDate?: string }
): PlannerItem | null;
export function deleteItem(
  course: Course,
  kind: 'reading' | 'task',
  itemId: string
): boolean;

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

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings;
export const MAX_SESSIONS: number;
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
export function markPhaseComplete(session: PomodoroSession, nowMs?: number): PomodoroSession;
export function pauseSession(session: PomodoroSession, nowMs?: number): PomodoroSession;
export function resumeSession(session: PomodoroSession, nowMs?: number): PomodoroSession;
export function elapsedWorkSeconds(
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
export function rehydrateSession(raw: unknown, nowMs?: number): PomodoroSession;

export function ensureStudyTime(course: Course): StudyTime;
export function getCourseStudySeconds(course: Course): number;
export function addStudyTime(
  course: Course,
  seconds: number,
  opts?: { source?: StudySession['source']; date?: string }
): Course;
export function setStudyTime(course: Course, newTotalSeconds: number): Course;
export function formatClock(totalSeconds: number): string;
export function formatHoursMinutes(totalSeconds: number): string;
export function parseHoursMinutesInput(text: string): number | null;
