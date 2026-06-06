'use strict';
// Platform-agnostic semester migration. Depends only on planner-core (no fs/DOM)
// so every storage adapter (filesystem today, Supabase later) can reuse it.
const { DEFAULT_READING_TAGS, DEFAULT_TASK_TAGS, getCourses } = require('../planner-core');

// Bring legacy semesters up to the tag-based status model. Adds the default
// tag sets and rewrites each item's `status` from a name string to a tag id.
// Idempotent: semesters that already carry tags are left untouched.
function migrateStatusToTagId(semester) {
  if (!Array.isArray(semester.readingTags) || semester.readingTags.length === 0) {
    semester.readingTags = JSON.parse(JSON.stringify(DEFAULT_READING_TAGS));
    const map = {
      pending: 'r-pending',
      seen: 'r-seen',
      summarized: 'r-summarized',
      studied: 'r-studied',
    };
    getCourses(semester).forEach((c) =>
      (c.readings || []).forEach((r) => {
        r.status = map[r.status] || 'r-pending';
      })
    );
  }
  if (!Array.isArray(semester.taskTags) || semester.taskTags.length === 0) {
    semester.taskTags = JSON.parse(JSON.stringify(DEFAULT_TASK_TAGS));
    const map = { 'not done': 't-pending', done: 't-done', reviewed: 't-studied' };
    getCourses(semester).forEach((c) =>
      (c.tasks || []).forEach((t) => {
        t.status = map[t.status] || 't-pending';
      })
    );
  }
  return semester;
}

module.exports = { migrateStatusToTagId };
