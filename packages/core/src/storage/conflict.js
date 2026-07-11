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
  // - Otherwise conflict iff actual !== expected (string compare of ISO timestamps).
  function detectConflict(expectedUpdatedAt, actualUpdatedAt) {
    if (expectedUpdatedAt == null) return false;
    if (actualUpdatedAt == null) return false;
    return actualUpdatedAt !== expectedUpdatedAt;
  }

  return { detectConflict, ConflictError };
});
