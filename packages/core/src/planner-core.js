'use strict';
// Pure planner logic shared by the renderer (app.js) and the test suite.
// Loaded in the browser via <script> (attaches window.PlannerCore) and in
// Node / Vitest via require() (module.exports). No DOM or Electron deps.
(function (global, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global) global.PlannerCore = api;
})(typeof window !== 'undefined' ? window : null, function () {
  // Default tag sets, used for new semesters and when migrating legacy data.
  // A tag's `section` decides whether items wearing it count toward course
  // progress: 'done' counts, 'pending' does not.
  const DEFAULT_READING_TAGS = [
    { id: 'r-pending', name: 'pending', color: '#ef4444', section: 'pending' },
    { id: 'r-seen', name: 'seen', color: '#f97316', section: 'pending' },
    { id: 'r-summarized', name: 'summarized', color: '#3b82f6', section: 'done' },
    { id: 'r-studied', name: 'studied', color: '#22c55e', section: 'done' },
  ];
  const DEFAULT_TASK_TAGS = [
    { id: 't-pending', name: 'pending', color: '#ef4444', section: 'pending' },
    { id: 't-done', name: 'done', color: '#3b82f6', section: 'done' },
    { id: 't-studied', name: 'studied', color: '#22c55e', section: 'done' },
  ];

  // The "pending" and "studied" tags of each kind cannot be deleted or renamed
  // (they can still be recolored). They anchor the workflow and Study Mode.
  const PROTECTED_TAG_IDS = new Set(['r-pending', 'r-studied', 't-pending', 't-studied']);

  function isProtectedTag(id) {
    return PROTECTED_TAG_IDS.has(id);
  }

  // Returns the reading/task tags array for a semester, falling back to the
  // defaults. Never mutates the semester.
  function getReadingTags(semester) {
    return Array.isArray(semester.readingTags) && semester.readingTags.length
      ? semester.readingTags
      : DEFAULT_READING_TAGS;
  }

  function getTaskTags(semester) {
    return Array.isArray(semester.taskTags) && semester.taskTags.length
      ? semester.taskTags
      : DEFAULT_TASK_TAGS;
  }

  // Unique id generator. A monotonic counter guarantees no collisions per run.
  let seq = 0;
  function uid(prefix) {
    seq += 1;
    return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}`;
  }

  // Courses of a semester, always as an array.
  function getCourses(semester) {
    return semester && Array.isArray(semester.courses) ? semester.courses : [];
  }

  // Percentage complete for a course. By default an item counts when its tag
  // belongs to the "done" section (ghost items via their remembered section).
  // When `studyMode` is true, only items explicitly tagged "r-studied" /
  // "t-studied" count — a pure calculation overlay, the tags are not modified.
  function courseProgress(course, semester, studyMode) {
    const readings = (course && course.readings) || [];
    const tasks = (course && course.tasks) || [];
    const total = readings.length + tasks.length;
    if (total === 0) return 0;

    let doneR, doneT;

    if (studyMode) {
      // In study mode, only the "studied" tag counts.
      doneR = readings.filter((r) => r.status === 'r-studied').length;
      doneT = tasks.filter((t) => t.status === 't-studied').length;
    } else {
      const rTags = getReadingTags(semester || {});
      const tTags = getTaskTags(semester || {});
      const rDoneIds = new Set(rTags.filter((t) => t.section === 'done').map((t) => t.id));
      const tDoneIds = new Set(tTags.filter((t) => t.section === 'done').map((t) => t.id));
      doneR = readings.filter(
        (r) => rDoneIds.has(r.status) || (r.status === '__deleted__' && r._ghostSection === 'done')
      ).length;
      doneT = tasks.filter(
        (t) => tDoneIds.has(t.status) || (t.status === '__deleted__' && t._ghostSection === 'done')
      ).length;
    }

    return Math.round(((doneR + doneT) / total) * 100);
  }

  // Add a course with a generated unique id; returns the new course.
  function addCourse(semester, { name, color }) {
    if (!Array.isArray(semester.courses)) semester.courses = [];
    const course = { id: uid('course'), name, color, readings: [], tasks: [] };
    semester.courses.push(course);
    return course;
  }

  // Remove a course by id; returns true if a course was removed.
  function deleteCourse(semester, courseId) {
    const courses = getCourses(semester);
    const idx = courses.findIndex((c) => c.id === courseId);
    if (idx === -1) return false;
    courses.splice(idx, 1);
    return true;
  }

  // Rename a course; returns the updated course, or null if not found.
  function editCourseName(semester, courseId, name) {
    const course = getCourses(semester).find((c) => c.id === courseId);
    if (!course) return null;
    course.name = name;
    return course;
  }

  // Recolor a course; returns the updated course, or null if not found.
  function editCourseColor(semester, courseId, color) {
    const course = getCourses(semester).find((c) => c.id === courseId);
    if (!course) return null;
    course.color = color;
    return course;
  }

  // Reorder courses to match the given ordered array of ids. Ids not present
  // are dropped; any courses missing from the list are appended (safety net).
  // Mirrors reorderTags.
  function reorderCourses(semester, orderedIds) {
    const arr = getCourses(semester);
    const byId = new Map(arr.map((c) => [c.id, c]));
    const reordered = orderedIds.map((id) => byId.get(id)).filter(Boolean);
    const seen = new Set(reordered);
    arr.forEach((c) => {
      if (!seen.has(c)) reordered.push(c);
    });
    arr.splice(0, arr.length, ...reordered);
  }

  // Add a custom tag to a semester's tag list (`type` is 'reading' or 'task').
  // Returns the new tag with a generated unique id.
  function addTag(semester, type, { name, color, section }) {
    const arr = type === 'reading' ? semester.readingTags : semester.taskTags;
    const prefix = type === 'reading' ? 'rt' : 'tt';
    const tag = { id: uid(prefix), name, color, section };
    arr.push(tag);
    return tag;
  }

  // Delete a tag by id. Protected tags cannot be deleted (returns false), and
  // returns false if the tag is not found. Items still wearing the tag become
  // ghosts (status '__deleted__') that remember the deleted tag's section so
  // progress stays stable.
  function deleteTag(semester, type, tagId) {
    if (isProtectedTag(tagId)) return false;
    const arr = type === 'reading' ? semester.readingTags : semester.taskTags;
    const idx = arr.findIndex((t) => t.id === tagId);
    if (idx === -1) return false;
    const ghost = arr[idx]; // remember section before deleting
    arr.splice(idx, 1);
    getCourses(semester).forEach((c) => {
      const items = type === 'reading' ? c.readings : c.tasks;
      (items || []).forEach((item) => {
        if (item.status === tagId) {
          item.status = '__deleted__';
          item._ghostSection = ghost.section;
        }
      });
    });
    return true;
  }

  // Rename and/or recolor a tag. Protected tags keep their name (the name is
  // locked) but can still be recolored. Returns false if the tag is not found.
  function editTag(semester, type, tagId, { name, color }) {
    const arr = type === 'reading' ? semester.readingTags : semester.taskTags;
    const tag = arr.find((t) => t.id === tagId);
    if (!tag) return false;
    if (!isProtectedTag(tagId) && name) tag.name = name;
    if (color) tag.color = color;
    return true;
  }

  // Reorder a tag list to match the given ordered array of ids. Ids not present
  // are dropped; any tags missing from the list are appended as a safety net.
  function reorderTags(semester, type, orderedIds) {
    const arr = type === 'reading' ? semester.readingTags : semester.taskTags;
    const byId = new Map(arr.map((t) => [t.id, t]));
    const reordered = orderedIds.map((id) => byId.get(id)).filter(Boolean);
    const seen = new Set(reordered);
    arr.forEach((t) => {
      if (!seen.has(t)) reordered.push(t);
    });
    arr.splice(0, arr.length, ...reordered);
  }

  return {
    DEFAULT_READING_TAGS,
    DEFAULT_TASK_TAGS,
    PROTECTED_TAG_IDS,
    isProtectedTag,
    getReadingTags,
    getTaskTags,
    addTag,
    deleteTag,
    editTag,
    reorderTags,
    uid,
    getCourses,
    courseProgress,
    addCourse,
    deleteCourse,
    editCourseName,
    editCourseColor,
    reorderCourses,
  };
});
