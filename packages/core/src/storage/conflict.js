'use strict';
// Pure conflict-detection logic for the cloud storage adapters. No I/O, no
// Supabase client — just the decision (compare timestamps) and the typed error,
// so it's unit-tested once and shared by both Supabase adapters (mobile + desktop).
//
// Dual-mode like planner-core.js / migrate.js: in the browser it's loaded via
// <script> and attaches window.PlannerConflict; in Node / Vitest it's require()d
// and pulls nothing (it has no dependencies). The desktop renderer reads
// window.PlannerConflict, the desktop main process / mobile app require() it.
(function (global, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global) global.PlannerConflict = api;
})(typeof window !== 'undefined' ? window : null, function () {
  // Thrown by a cloud adapter's save() when the row changed on another device
  // since we last observed it. Carries enough context for the resolution UI
  // (12.2 mobile / 12.3 desktop) to offer "keep mine" / "load latest" / backup.
  class ConflictError extends Error {
    constructor(id, opts) {
      const o = opts || {};
      super(`Conflict on semester "${id}": it changed on another device.`);
      this.name = 'ConflictError';
      this.code = 'CONFLICT';
      this.semesterId = id;
      this.expectedUpdatedAt = o.expectedUpdatedAt || null;
      this.actualUpdatedAt = o.actualUpdatedAt || null;
      this.remote = o.remote || null; // the remote semester blob, for the "load latest"/backup paths
    }
  }

  // Pure decision. Returns true when the cloud row was modified since we loaded it.
  // - If we never observed a baseline (expected == null) → no conflict (first write / unknown).
  // - If the row didn't exist before (actual == null) → no conflict (fresh insert).
  // - Otherwise conflict iff the two timestamps are different instants.
  function detectConflict(expectedUpdatedAt, actualUpdatedAt) {
    if (expectedUpdatedAt == null) return false;
    if (actualUpdatedAt == null) return false;
    if (expectedUpdatedAt === actualUpdatedAt) return false;
    // Postgres/PostgREST can return a timestamp in a different string
    // representation than the one we cached (e.g. differing sub-second
    // precision, or a "+00:00" vs "Z" UTC suffix) even when it is the exact
    // same instant. A raw string compare treats that as a conflict on every
    // single save. Compare the parsed instants instead; only fall back to
    // "different" for a value that doesn't even parse as a date, since that's
    // a genuinely unexpected shape rather than a formatting artifact.
    const expectedMs = Date.parse(expectedUpdatedAt);
    const actualMs = Date.parse(actualUpdatedAt);
    if (Number.isNaN(expectedMs) || Number.isNaN(actualMs)) return true;
    return expectedMs !== actualMs;
  }

  return { detectConflict, ConflictError };
});
