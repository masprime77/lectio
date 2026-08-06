// Transient, in-memory holder for an in-progress Moodle import — never
// persisted. Set by moodle-import.tsx once the course-content fetch
// completes; read (and cleared) by moodle-triage.tsx. A plain module-level
// variable works here because Expo Router screens are React components
// mounted/unmounted on navigation within the same JS runtime, not separate
// processes — the module instance is shared across the push from
// moodle-import to moodle-triage, the same way `storage` and `prefs` are used
// as app-wide singletons elsewhere in this codebase. This is the mobile
// equivalent of the desktop renderer's `moodleImport` global object (Phase 16
// Part B, desktop) — same purpose, different mechanism because mobile has no
// single global script scope to hang a variable off of.
import type { MoodleMappedContent } from '../../types/lectio-core';

export interface MoodleImportSession {
  semesterId: string;
  courseId: string;
  accountBaseUrl: string;
  mapped: MoodleMappedContent;
}

let session: MoodleImportSession | null = null;

export function setMoodleImportSession(next: MoodleImportSession): void {
  session = next;
}

export function getMoodleImportSession(): MoodleImportSession | null {
  return session;
}

export function clearMoodleImportSession(): void {
  session = null;
}
