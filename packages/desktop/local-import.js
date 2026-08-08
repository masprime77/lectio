'use strict';
// One-time, idempotent, NON-DESTRUCTIVE upload of the user's LOCAL fs semesters
// to their cloud (Supabase) account (Phase 11.3).
//
// "Local" source  = fs-storage via the preload bridge (window.planner.*), read
//                   only — local copies are never deleted; fs stays the fallback.
// "Cloud" target  = the active Supabase adapter (passed in by app.js).
//
// Because the same account is used on Mac and phone, uploading must not clobber
// anything already in the cloud and re-running must not duplicate:
//   - a local id NOT in the cloud           → upload as-is ('new')
//   - a local id ALREADY in the cloud        → default SKIP; the user may instead
//                                              'upload-as-new' under a fresh id.
//   - a plain 'upload' never overwrites an existing cloud id (safety guard).
// So a second run finds everything present → all skipped.
//
// Dual-mode like planner-core.js (window.LocalImport in the renderer,
// module.exports in Node). The fs-reading helper needs window.planner, but
// planUpload/runUpload take the cloud adapter by argument, so the pure diff/
// upload logic is exercisable in isolation.
(function (global, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global) global.LocalImport = api;
})(typeof window !== 'undefined' ? window : null, function () {
  // slugify + uniqueSemesterId: copied from app.js (and mirrored by the mobile
  // semester-id.ts) so this file is self-contained regardless of script order.
  function slugify(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'semester';
  }
  function uniqueSemesterId(name, existingIds) {
    let id = slugify(name);
    let n = 2;
    while (existingIds.has(id)) id = `${slugify(name)}-${n++}`;
    return id;
  }

  // Read every local semester (full object) from fs-storage. Read-only.
  async function getLocalSemesters() {
    const summaries = await window.planner.listSemesters();
    const out = [];
    for (const s of summaries) out.push(await window.planner.getSemester(s.id));
    return out;
  }

  // Diff local vs cloud by id. Returns [{ semester, status: 'new' | 'exists' }].
  async function planUpload(cloudStorage) {
    const local = await getLocalSemesters();
    const cloud = await cloudStorage.list();
    const cloudIds = new Set(cloud.map((c) => c.id));
    return local.map((sem) => ({
      semester: sem,
      status: cloudIds.has(sem.id) ? 'exists' : 'new',
    }));
  }

  // Apply per-semester decisions. action: 'upload' | 'skip' | 'upload-as-new'.
  // Re-reads the cloud ids up front so re-runs (and ids minted this run) never
  // collide; 'upload-as-new' re-slugs to a fresh id, keeping both copies.
  async function runUpload(cloudStorage, decisions) {
    const existingIds = new Set((await cloudStorage.list()).map((c) => c.id));
    const results = [];
    for (const d of decisions) {
      if (d.action === 'skip') {
        results.push({ id: d.semester.id, skipped: true });
        continue;
      }
      let sem = d.semester;
      if (d.action === 'upload-as-new') {
        const newId = uniqueSemesterId(sem.name || sem.id, existingIds);
        sem = { ...sem, id: newId };
      } else if (existingIds.has(sem.id)) {
        // Safety: a plain 'upload' must never overwrite an existing cloud copy
        // (it's only chosen for ids that were 'new' at plan time).
        results.push({ id: sem.id, skipped: true });
        continue;
      }
      await cloudStorage.save(sem.id, sem);
      existingIds.add(sem.id);
      results.push({ id: sem.id, uploaded: true });
    }
    return results;
  }

  return { slugify, uniqueSemesterId, getLocalSemesters, planUpload, runUpload };
});
