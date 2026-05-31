'use strict';
// Pure planner logic shared by the renderer (app.js) and the test suite.
// Loaded in the browser via <script> (attaches window.PlannerCore) and in
// Node / Vitest via require() (module.exports). No DOM or Electron deps.
(function (global, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global) global.PlannerCore = api;
})(typeof window !== 'undefined' ? window : null, function () {
  const READING_CYCLE = ['pending', 'seen', 'summarized', 'studied'];
  const TASK_CYCLE = ['not done', 'done', 'reviewed'];

  // Advance to the next status in a cycle. An unknown current value resets to
  // the first status (indexOf === -1 → (-1 + 1) % len === 0).
  function nextStatus(cycle, current) {
    const i = cycle.indexOf(current);
    return cycle[(i + 1) % cycle.length];
  }
  const cycleReadingStatus = (status) => nextStatus(READING_CYCLE, status);
  const cycleTaskStatus = (status) => nextStatus(TASK_CYCLE, status);

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

  // Percentage complete for a course: readings count when "studied"; tasks
  // count when "done" or "reviewed".
  function courseProgress(course) {
    const readings = (course && course.readings) || [];
    const tasks = (course && course.tasks) || [];
    const total = readings.length + tasks.length;
    if (total === 0) return 0;
    const doneReadings = readings.filter((r) => r.status === 'studied').length;
    const doneTasks = tasks.filter((t) => t.status === 'done' || t.status === 'reviewed').length;
    return Math.round(((doneReadings + doneTasks) / total) * 100);
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

  return {
    READING_CYCLE,
    TASK_CYCLE,
    nextStatus,
    cycleReadingStatus,
    cycleTaskStatus,
    uid,
    getCourses,
    courseProgress,
    addCourse,
    deleteCourse,
    editCourseName,
  };
});
