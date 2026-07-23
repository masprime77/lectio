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

  // German month names as they appear in Moodle section names, lower-cased.
  // No abbreviations seen in the wild across the two validated courses, so
  // only full names are matched.
  const GERMAN_MONTHS = {
    januar: 1,
    februar: 2,
    märz: 3,
    april: 4,
    mai: 5,
    juni: 6,
    juli: 7,
    august: 8,
    september: 9,
    oktober: 10,
    november: 11,
    dezember: 12,
  };

  // Parses a section name of the shape "13. April - 19. April" (day, month,
  // day, month — no year; Moodle never includes one in these section names).
  // Accepts a plain hyphen or an en dash between the two dates, and tolerates
  // surrounding/inner whitespace. Returns null for anything that doesn't match
  // — topic-named sections ("Thema 00 - Einleitung", "Allgemeines") are
  // expected to return null; this is the normal, common case for some courses,
  // not an error.
  const DATE_RANGE_RE =
    /^\s*(\d{1,2})\.\s*([A-Za-zÀ-ÖØ-öø-ÿ]+)\s*[-–]\s*(\d{1,2})\.\s*([A-Za-zÀ-ÖØ-öø-ÿ]+)\s*$/;

  function parseGermanDateRangeSectionName(name) {
    if (typeof name !== 'string') return null;
    const match = DATE_RANGE_RE.exec(name);
    if (!match) return null;
    const [, startDay, startMonthName, endDay, endMonthName] = match;
    const startMonth = GERMAN_MONTHS[startMonthName.toLowerCase()];
    const endMonth = GERMAN_MONTHS[endMonthName.toLowerCase()];
    if (!startMonth || !endMonth) return null;
    return {
      startDay: Number(startDay),
      startMonth,
      endDay: Number(endDay),
      endMonth,
    };
  }

  // The Phase 14 orchestrator. Takes the raw `sections` array as returned by
  // Moodle's core_course_get_contents (each with `visible`, `uservisible`,
  // `name`, `section` (Moodle's own raw section number), and `modules`), and
  // returns `{ weeks: [...] }`.
  //
  // Each week is `{ moodleSection, sectionName, dateRange, items }`:
  //   - moodleSection: the section's own raw Moodle section number (Moodle's
  //     sequential order, gaps allowed once hidden sections are dropped — this
  //     IS "raw section order", not a re-index) — used as the grouping/fallback
  //     ordering when the name doesn't parse as a date range.
  //   - sectionName: the section's name, verbatim.
  //   - dateRange: parseGermanDateRangeSectionName(sectionName)'s result, or
  //     null when the name isn't a parseable date range.
  //   - items: mapModuleToItem() output for every importable module in the
  //     section, in Moodle's original order.
  //
  // Items never carry a week/type field themselves — grouping lives at the
  // week level only; readings-vs-tasks classification is the user's job in the
  // Phase 16 import UI, not this mapper's.
  //
  // By default, sections whose surviving `items` end up empty (e.g. a section
  // made only of label/forum/choice modules, like course 1998's "Allgemeines")
  // are dropped entirely — they'd just be noise in the Phase 16 triage screen.
  // Pass `{ includeEmptyWeeks: true }` to keep them (e.g. for debugging).
  function mapCourseContents(sections, options) {
    const includeEmptyWeeks = !!(options && options.includeEmptyWeeks);
    const weeks = (sections || [])
      .filter(isSectionVisible)
      .map((section) => {
        const items = (section.modules || [])
          .filter(isModuleImportable)
          .map(mapModuleToItem);
        return {
          moodleSection: section.section,
          sectionName: section.name,
          dateRange: parseGermanDateRangeSectionName(section.name),
          items,
        };
      })
      .filter((week) => includeEmptyWeeks || week.items.length > 0);
    return { weeks };
  }

  return {
    IMPORTABLE_MODNAMES,
    isModuleImportable,
    isSectionVisible,
    mapModuleToItem,
    parseGermanDateRangeSectionName,
    mapCourseContents,
  };
});
