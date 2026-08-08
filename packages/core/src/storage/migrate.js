'use strict';
// Platform-agnostic semester migration. Depends only on planner-core (no fs/DOM)
// so every storage adapter (filesystem, device, mobile, and the desktop renderer)
// can reuse it.
//
// Dual-mode like planner-core.js: in the browser it's loaded via <script> and
// attaches window.PlannerMigrate (reading window.PlannerCore); in Node / Vitest
// it's require()d and pulls planner-core via require(). The migration LOGIC is
// unchanged from the single-mode version — only the module wrapper differs.
(function (global, factory) {
  const core =
    typeof module !== 'undefined' && module.exports
      ? require('../planner-core')
      : global && global.PlannerCore;
  const api = factory(core);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global) global.PlannerMigrate = api;
})(typeof window !== 'undefined' ? window : null, function (core) {
  const { DEFAULT_READING_TAGS, DEFAULT_TASK_TAGS, getCourses } = core;

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

  return { migrateStatusToTagId };
});
