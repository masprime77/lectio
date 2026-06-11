// Hand-written types for @lectio/core (which ships as plain JS, untyped).
//
// @lectio/core resolves to a real symlinked JS file in this workspace, so a
// plain ambient `declare module` gets shadowed by that resolution. Instead this
// file is a normal declaration *module*, and tsconfig.json maps the core import
// specifiers to it via `paths` (see "@lectio/core*"). One file backs every
// subpath the app imports — `@lectio/core`, `@lectio/core/planner-core`,
// `@lectio/core/storage/migrate`, `@lectio/core/storage/contract`. It
// deliberately omits the Node-only subpaths (`semester-store`, `ipc-handlers`,
// `storage/fs`) so they stay unimportable from the RN bundle.

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
export function getCourses(semester: Semester): Course[];
export function courseProgress(
  course: Course,
  semester: Semester,
  studyMode?: boolean
): number;
export interface CourseBreakdown {
  readings: { done: number; total: number };
  tasks: { done: number; total: number };
}
export type SortOrder =
  | 'progress-asc'
  | 'progress-desc'
  | 'alpha-asc'
  | 'alpha-desc'
  | 'week-asc'
  | 'week-desc';
export const SORT_ORDERS: SortOrder[];
export function courseBreakdown(
  course: Course,
  semester: Semester,
  studyMode?: boolean
): CourseBreakdown;
export function sortedCourses(
  courses: Course[],
  semester: Semester,
  sortOrder: SortOrder,
  studyMode?: boolean
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

// planner-core's "." export is a CommonJS object; expose it as a default too.
declare const core: {
  DEFAULT_READING_TAGS: Tag[];
  DEFAULT_TASK_TAGS: Tag[];
  getReadingTags(semester: Semester): Tag[];
  getTaskTags(semester: Semester): Tag[];
  getCourses(semester: Semester): Course[];
  courseProgress(course: Course, semester: Semester, studyMode?: boolean): number;
  uid(prefix: string): string;
};
export default core;
