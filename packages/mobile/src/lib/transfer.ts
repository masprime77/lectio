// Mobile file transfer: export a semester/course to a shareable `.lectio.json`
// file (the system share sheet) and import one back from a picked file (the
// document picker) — the mobile equivalent of the desktop's save/open dialogs.
//
// The on-disk bytes are the SHARED envelope built and validated by
// `@lectio/core/integrations/lectio-file` (the exact `_lectioType`/`_version`
// + course projection the desktop reads/writes), so files interchange freely
// between desktop and mobile. This module owns only the platform file I/O and
// storage glue; all build/parse/transform logic lives in core.
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import {
  buildSemesterFile,
  buildCourseFile,
  parseSemesterFile,
  parseCourseFile,
  withResetStatuses,
  uniqueSemesterId,
  prepareImportedCourse,
} from '@lectio/core/integrations/lectio-file';
import { uid } from '@lectio/core/planner-core';
import type { Course, Semester } from '../../types/lectio-core';
import { storage } from '../storage';

// A safe filename stem, mirroring the desktop's export naming.
function fileStem(name: string): string {
  return (name || 'lectio').replace(/[^a-z0-9_-]/gi, '_');
}

// Write `payload` as pretty JSON to a fresh cache file and present the share
// sheet for it. The cache file is disposable — the OS reclaims it.
async function shareJson(stem: string, payload: unknown): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  const file = new File(Paths.cache, `${stem}.lectio.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(payload, null, 2));
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
    dialogTitle: 'Share Lectio file',
  });
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export async function exportSemester(id: string): Promise<void> {
  const semester = await storage.get(id);
  await shareJson(fileStem(semester.name || semester.id), buildSemesterFile(semester));
}

export async function exportCourse(course: Course): Promise<void> {
  await shareJson(fileStem(course.name || course.id), buildCourseFile(course));
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

// Present the document picker and return the parsed JSON payload, or null if
// the user cancelled. Throws (friendly message) on an unreadable / non-JSON file.
async function pickJson(): Promise<unknown | null> {
  // No `type` filter on purpose: some share targets save a `.lectio.json` with
  // a non-JSON mime type, which would grey the file out in a filtered picker.
  // We validate the content below instead, so any file can be selected.
  const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  if (res.canceled) return null;
  const asset = res.assets[0];
  if (!asset) return null;
  const text = await new File(asset.uri).text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
}

// Pick + validate a semester export. Returns the semester, or null if cancelled.
// Throws core's friendly message if the file is the wrong type or corrupt.
export async function pickSemesterFile(): Promise<Semester | null> {
  const payload = await pickJson();
  if (payload === null) return null;
  return parseSemesterFile(payload) as Semester;
}

// Pick + validate a course export. Returns the course, or null if cancelled.
export async function pickCourseFile(): Promise<Course | null> {
  const payload = await pickJson();
  if (payload === null) return null;
  return parseCourseFile(payload) as Course;
}

export interface ImportedSemester {
  id: string;
  name: string;
}

// Save an imported semester. `keepStatus=false` resets every reading/task to
// its default pending tag. Never overwrites: on an id collision a fresh unique
// id is assigned, so an import can't clobber an existing semester.
export async function saveImportedSemester(
  semester: Semester,
  keepStatus: boolean,
): Promise<ImportedSemester> {
  let toSave = keepStatus ? semester : withResetStatuses(semester);
  const existing = await storage.list();
  const ids = new Set(existing.map((s) => s.id));
  if (ids.has(toSave.id)) {
    toSave = { ...toSave, id: uniqueSemesterId(toSave.name, ids) };
  }
  await storage.save(toSave.id, toSave);
  return { id: toSave.id, name: toSave.name };
}

export interface ImportedCourse {
  name: string;
}

// Add an imported course to an existing semester with fresh ids (the course and
// every reading/task), so it can't collide with anything already there.
export async function saveImportedCourse(
  semesterId: string,
  course: Course,
): Promise<ImportedCourse> {
  const semester = await storage.get(semesterId);
  const fresh = prepareImportedCourse(course, uid);
  const next: Semester = {
    ...semester,
    courses: [...(semester.courses ?? []), fresh],
  };
  await storage.save(semesterId, next);
  return { name: fresh.name };
}
