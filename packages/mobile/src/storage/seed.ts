// First-run seed. If storage is empty, persist one realistic sample semester so
// the MVP shows real content (varied progress bars). Items reference the default
// tag ids directly ('r-pending'/'r-seen'/'r-summarized'/'r-studied', 't-pending'/
// 't-done'/'t-studied'), and the semester carries the default tag arrays so
// `migrateStatusToTagId` treats it as already-migrated and leaves it untouched
// (the migration only rewrites legacy *name* strings when tags are absent).
import { DEFAULT_READING_TAGS, DEFAULT_TASK_TAGS } from '@lectio/core/planner-core';
import type { Semester, Storage } from '../../types/lectio-core';

const SAMPLE: Semester = {
  id: 'ss2025',
  name: 'Summer Semester 2025',
  startDate: '2025-04-07',
  weeks: 15,
  readingTags: DEFAULT_READING_TAGS,
  taskTags: DEFAULT_TASK_TAGS,
  courses: [
    {
      id: 'course-algorithms',
      name: 'Algorithms & Data Structures',
      color: '#4a90d9',
      readings: [
        { id: 'r-1', week: 1, title: 'Asymptotic Notation', status: 'r-studied' },
        { id: 'r-2', week: 2, title: 'Sorting & Selection', status: 'r-summarized' },
        { id: 'r-3', week: 3, title: 'Hash Tables', status: 'r-seen' },
        { id: 'r-4', week: 4, title: 'Balanced Trees', status: 'r-pending' },
      ],
      tasks: [
        { id: 't-1', week: 1, title: 'Problem Set 1', dueDate: '2025-04-14', status: 't-studied' },
        { id: 't-2', week: 3, title: 'Problem Set 2', dueDate: '2025-04-28', status: 't-pending' },
      ],
    },
    {
      id: 'course-databases',
      name: 'Database Systems',
      color: '#22c55e',
      readings: [
        { id: 'r-5', week: 1, title: 'Relational Model', status: 'r-studied' },
        { id: 'r-6', week: 2, title: 'SQL & Query Processing', status: 'r-pending' },
        { id: 'r-7', week: 3, title: 'Indexing & B-Trees', status: 'r-pending' },
      ],
      tasks: [
        { id: 't-3', week: 2, title: 'Schema Design Lab', dueDate: '2025-04-21', status: 't-done' },
        { id: 't-4', week: 4, title: 'Query Optimization Lab', dueDate: '2025-05-05', status: 't-pending' },
      ],
    },
  ],
};

/** Save the sample semester once, only if storage has no semesters yet. */
export async function ensureSeed(storage: Storage): Promise<void> {
  const existing = await storage.list();
  if (existing.length === 0) {
    await storage.save(SAMPLE.id, SAMPLE);
  }
}
