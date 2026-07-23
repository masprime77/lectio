'use strict';
// Pure, platform-free mapper from a Moodle `core_course_get_contents` response
// to Lectio-shaped, type-agnostic import candidates. See
// docs/MOODLE_INTEGRATION_SPIKE.md for the full design rationale.
//
// This module never classifies an item as a reading or a task — that choice
// belongs to the user in the Phase 16 import UI. It only decides which raw
// Moodle modules are even worth offering, and shapes them into a stable,
// token-free item.
//
// No DOM, no Electron, no file system, no network. Dual-mode wrapper so it
// loads in Node (`require`) and the browser (`window.LectioMoodle`), mirroring
// planner-core.js and integrations/lectio-file.js.
(function (global, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global) global.LectioMoodle = api;
})(typeof window !== 'undefined' ? window : null, function () {
  // The only Moodle module types that represent real course material. Text
  // blocks (`label`), discussion (`forum`), surveys (`choice`), quizzes, and
  // everything else are never import candidates — confirmed against two real,
  // structurally different TU Darmstadt courses in the Phase 13 spike.
  const IMPORTABLE_MODNAMES = new Set(['resource', 'url', 'folder']);

  // True when a module's own type/visibility make it a valid import candidate.
  // Does NOT consider the section it lives in — see isSectionVisible for that.
  // `visible` is Moodle's course-editor toggle (0/1); `uservisible` is Moodle's
  // own computed "can THIS user actually see it" flag (access restrictions,
  // dates, etc.) and takes precedence when present.
  function isModuleImportable(mod) {
    if (!mod || !IMPORTABLE_MODNAMES.has(mod.modname)) return false;
    if (mod.visible === 0) return false;
    if (mod.uservisible === false) return false;
    return true;
  }

  // True when a section itself should be considered at all. Live courses keep
  // hidden trailing sections (exam, review) that must never surface as
  // importable content, confirmed live on course 1998 ("DMML Klausur",
  // "Einsicht", both visible:0/uservisible:false).
  function isSectionVisible(section) {
    if (!section) return false;
    if (section.visible === 0) return false;
    if (section.uservisible === false) return false;
    return true;
  }

  // Shape a raw Moodle module into the stable, token-free item Lectio stores.
  // Always `module.url` (session-friendly, no token) — NEVER
  // `contents[].fileurl` (requires the wstoken as a query param). `module.name`
  // is used verbatim, no parsing. `moodleModuleId` is the stable id a later
  // re-sync (Phase 16+) can match against.
  function mapModuleToItem(mod) {
    return {
      name: mod.name,
      url: mod.url,
      moodleModuleId: mod.id,
    };
  }

  return {
    IMPORTABLE_MODNAMES,
    isModuleImportable,
    isSectionVisible,
    mapModuleToItem,
  };
});
