'use strict';
// Pure, platform-free helpers for the Lectio `.lectio.json` interchange format.
//
// A `.lectio.json` file is a small envelope wrapping either a whole semester or
// a single course:
//
//   semester export: { _lectioType: 'semester', _version: 1, semester }
//   course export:   { _lectioType: 'course',   _version: 1, course }
//
// The desktop already builds and validates this envelope inline (export in
// `ipc-handlers.js`, import/validation in `app.js`). This module re-implements
// that exact contract as pure functions so the mobile app can produce and
// consume byte-compatible files — the platform file I/O (share sheet / document
// picker) lives in the apps; only the build/parse/transform logic lives here.
//
// No DOM, no Electron, no file system, no network. Dual-mode wrapper so it loads
// in Node (`require`) and the browser (`window.LectioFile`), mirroring
// planner-core.
(function (global, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global) global.LectioFile = api;
})(typeof window !== 'undefined' ? window : null, function () {
  // Node loads uid from planner-core's CommonJS surface; the browser global is
  // attached as `window.PlannerCore`. Resolved lazily so requiring this module
  // never throws in the browser (where there is no `require`).
  function defaultMakeId(prefix) {
    if (typeof require === 'function') {
      return require('../planner-core.js').uid(prefix);
    }
    return global && global.PlannerCore ? global.PlannerCore.uid(prefix) : prefix;
  }

  // Bumped only on a breaking change to the envelope; files carry it so older
  // readers can detect a format they don't understand.
  const LECTIO_FILE_VERSION = 1;

  // -------------------------------------------------------------------------
  // Build (export)
  // -------------------------------------------------------------------------

  // Wrap a semester in the export envelope. The semester is passed through
  // as-is (tags included) — exactly what the desktop writes — so the caller is
  // responsible for handing in a clean/serializable object.
  function buildSemesterFile(semester) {
    return { _lectioType: 'semester', _version: LECTIO_FILE_VERSION, semester };
  }

  // Project a course down to only the fields that belong in a course export
  // (no tags). Mirrors the desktop's exportCourse "clean" projection.
  function cleanCourse(course) {
    return {
      id: course.id,
      name: course.name,
      color: course.color,
      readings: (course.readings || []).map(({ id, week, title, status }) => ({
        id,
        week,
        title,
        status,
      })),
      tasks: (course.tasks || []).map(({ id, week, title, dueDate, status }) => ({
        id,
        week,
        title,
        dueDate,
        status,
      })),
    };
  }

  // Wrap a single course in the export envelope, cleaning it first.
  function buildCourseFile(course) {
    return {
      _lectioType: 'course',
      _version: LECTIO_FILE_VERSION,
      course: cleanCourse(course),
    };
  }

  // -------------------------------------------------------------------------
  // Parse (import)
  // -------------------------------------------------------------------------

  // Validate an already-parsed payload as a semester export and return the inner
  // semester. Throws with the desktop's user-facing messages on a bad file.
  function parseSemesterFile(payload) {
    if (!payload || payload._lectioType !== 'semester') {
      throw new Error('This file is not a Lectio semester export.');
    }
    const semester = payload.semester;
    if (!semester || !semester.id || !Array.isArray(semester.courses)) {
      throw new Error('The semester file appears corrupt or invalid.');
    }
    return semester;
  }

  // Validate an already-parsed payload as a course export and return the inner
  // course. Throws with the desktop's user-facing messages on a bad file.
  function parseCourseFile(payload) {
    if (!payload || payload._lectioType !== 'course') {
      throw new Error('This file is not a Lectio course export.');
    }
    const course = payload.course;
    if (!course || !course.name) {
      throw new Error('The course file appears corrupt or invalid.');
    }
    return course;
  }

  // -------------------------------------------------------------------------
  // Transforms (import helpers)
  // -------------------------------------------------------------------------

  // Return a deep copy of the semester with every reading/task reset to its
  // default "pending" tag (the optional "reset progress" import choice). Never
  // mutates the input.
  function withResetStatuses(semester) {
    const clone = JSON.parse(JSON.stringify(semester));
    (clone.courses || []).forEach((c) => {
      (c.readings || []).forEach((r) => {
        r.status = 'r-pending';
      });
      (c.tasks || []).forEach((t) => {
        t.status = 't-pending';
      });
    });
    return clone;
  }

  // Tiny slug, re-implemented here so core never depends on the apps'
  // semester-id helpers. Matches the desktop's slugify.
  function slugify(s) {
    return (
      String(s)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'semester'
    );
  }

  // Pick a semester id that doesn't collide with `existingIds` (an array or
  // Set). Tries the bare slug first, then `-2`, `-3`, … — mirroring the
  // desktop's import re-slug loop.
  function uniqueSemesterId(name, existingIds) {
    const ids = existingIds instanceof Set ? existingIds : new Set(existingIds || []);
    const base = slugify(name);
    let id = base;
    let n = 2;
    while (ids.has(id)) id = `${base}-${n++}`;
    return id;
  }

  // Build a fresh course from an imported one, assigning brand-new ids to the
  // course and every reading/task so it can't collide inside the target
  // semester. `makeId(prefix)` defaults to core's uid; pass a deterministic one
  // in tests. Mirrors the desktop's importCourse.
  function prepareImportedCourse(course, makeId) {
    const newId = typeof makeId === 'function' ? makeId : defaultMakeId;
    return {
      id: newId('course'),
      name: course.name,
      color: course.color || '#4A90D9',
      readings: (course.readings || []).map((r) => ({ ...r, id: newId('r') })),
      tasks: (course.tasks || []).map((t) => ({ ...t, id: newId('t') })),
    };
  }

  return {
    LECTIO_FILE_VERSION,
    buildSemesterFile,
    buildCourseFile,
    cleanCourse,
    parseSemesterFile,
    parseCourseFile,
    withResetStatuses,
    slugify,
    uniqueSemesterId,
    prepareImportedCourse,
  };
});
