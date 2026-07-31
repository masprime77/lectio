import { describe, it, expect } from 'vitest';
import moodle from '../../src/integrations/moodle.js';

const {
  IMPORTABLE_MODNAMES,
  isModuleImportable,
  isSectionVisible,
  mapModuleToItem,
  parseGermanDateRangeSectionName,
  mapCourseContents,
} = moodle;

// Representative real module shapes (trimmed), based on
// spikes/moodle-poc/output/course-1998-contents.json and course-10-contents.json.
const resourceModule = () => ({
  id: 87317,
  modname: 'resource',
  name: '1. Vorlesung: Einführung',
  url: 'https://moodle.informatik.tu-darmstadt.de/mod/resource/view.php?id=87317',
  visible: 1,
  uservisible: true,
});

const urlModule = () => ({
  id: 87318,
  modname: 'url',
  name: '1. Vorlesung: Aufzeichnung (2021)',
  url: 'https://moodle.informatik.tu-darmstadt.de/mod/url/view.php?id=87318',
  visible: 1,
  uservisible: true,
});

const folderModule = () => ({
  id: 294,
  modname: 'folder',
  name: 'Bisherige Zwischenklausuren zum Selberrechnen',
  url: 'https://moodle.informatik.tu-darmstadt.de/mod/folder/view.php?id=294',
  visible: 1,
  uservisible: true,
});

describe('IMPORTABLE_MODNAMES', () => {
  it('is exactly resource/url/folder', () => {
    expect([...IMPORTABLE_MODNAMES].sort()).toEqual(['folder', 'resource', 'url']);
  });
});

describe('isModuleImportable', () => {
  it('accepts resource, url, and folder modules that are visible', () => {
    expect(isModuleImportable(resourceModule())).toBe(true);
    expect(isModuleImportable(urlModule())).toBe(true);
    expect(isModuleImportable(folderModule())).toBe(true);
  });

  it('rejects modname types that are never import candidates', () => {
    expect(isModuleImportable({ id: 1, modname: 'label', visible: 1, uservisible: true })).toBe(false);
    expect(isModuleImportable({ id: 2, modname: 'forum', visible: 1, uservisible: true })).toBe(false);
    expect(isModuleImportable({ id: 3, modname: 'choice', visible: 1, uservisible: true })).toBe(false);
    expect(isModuleImportable({ id: 4, modname: 'page', visible: 1, uservisible: true })).toBe(false);
    expect(isModuleImportable({ id: 5, modname: 'quiz', visible: 1, uservisible: true })).toBe(false);
    expect(isModuleImportable({ id: 6, modname: 'assign', visible: 1, uservisible: true })).toBe(false);
  });

  it('rejects a module hidden via the editor visible flag', () => {
    expect(isModuleImportable({ ...resourceModule(), visible: 0 })).toBe(false);
  });

  it('rejects a module Moodle computed as not user-visible (access restrictions)', () => {
    expect(isModuleImportable({ ...resourceModule(), uservisible: false })).toBe(false);
  });

  it('rejects null/undefined input', () => {
    expect(isModuleImportable(null)).toBe(false);
    expect(isModuleImportable(undefined)).toBe(false);
  });
});

describe('isSectionVisible', () => {
  it('accepts a normal visible section', () => {
    expect(isSectionVisible({ visible: 1, uservisible: true })).toBe(true);
  });

  it('rejects a section hidden via the editor visible flag', () => {
    // Real shape: course 1998's trailing "DMML Klausur" section.
    expect(isSectionVisible({ name: 'DMML Klausur', visible: 0, uservisible: false })).toBe(false);
  });

  it('rejects a section Moodle computed as not user-visible even if visible:1', () => {
    expect(isSectionVisible({ visible: 1, uservisible: false })).toBe(false);
  });

  it('rejects null/undefined input', () => {
    expect(isSectionVisible(null)).toBe(false);
    expect(isSectionVisible(undefined)).toBe(false);
  });
});

describe('mapModuleToItem', () => {
  it('shapes a module into {name, url, moodleModuleId}, dropping everything else', () => {
    const item = mapModuleToItem(resourceModule());
    expect(item).toEqual({
      name: '1. Vorlesung: Einführung',
      url: 'https://moodle.informatik.tu-darmstadt.de/mod/resource/view.php?id=87317',
      moodleModuleId: 87317,
    });
  });

  it('always uses module.url, never a fileurl field, even if present on the input', () => {
    const withFileurl = {
      ...resourceModule(),
      contents: [{ fileurl: 'https://moodle.informatik.tu-darmstadt.de/pluginfile.php/1/mod_resource/content/0/x.pdf?token=abc' }],
    };
    const item = mapModuleToItem(withFileurl);
    expect(item.url).toBe(withFileurl.url);
    expect(item.url).not.toContain('pluginfile.php');
    expect(item.url).not.toContain('token=');
  });
});

describe('parseGermanDateRangeSectionName', () => {
  it('parses a standard same-month range', () => {
    expect(parseGermanDateRangeSectionName('13. April - 19. April')).toEqual({
      startDay: 13,
      startMonth: 4,
      endDay: 19,
      endMonth: 4,
    });
  });

  it('parses a range that crosses a month boundary', () => {
    expect(parseGermanDateRangeSectionName('29. Juni - 5. Juli')).toEqual({
      startDay: 29,
      startMonth: 6,
      endDay: 5,
      endMonth: 7,
    });
  });

  it('is tolerant of an en dash and extra whitespace', () => {
    expect(parseGermanDateRangeSectionName('6. Juli – 12. Juli')).toEqual({
      startDay: 6,
      startMonth: 7,
      endDay: 12,
      endMonth: 7,
    });
    expect(parseGermanDateRangeSectionName('  27. April   -   3. Mai  ')).toEqual({
      startDay: 27,
      startMonth: 4,
      endDay: 3,
      endMonth: 5,
    });
  });

  it('is case-insensitive on the month name', () => {
    expect(parseGermanDateRangeSectionName('13. april - 19. APRIL')).toEqual({
      startDay: 13,
      startMonth: 4,
      endDay: 19,
      endMonth: 4,
    });
  });

  // Real shape from course 43541, whose 14 weeks all carry a "Woche N: " prefix
  // in front of an otherwise ordinary range.
  it('finds a range behind a "Woche N: " prefix', () => {
    expect(parseGermanDateRangeSectionName('Woche 1: 22. April – 25. April')).toEqual({
      startDay: 22,
      startMonth: 4,
      endDay: 25,
      endMonth: 4,
    });
    expect(parseGermanDateRangeSectionName('Woche 11: 30. Juni - 4. Juli')).toEqual({
      startDay: 30,
      startMonth: 6,
      endDay: 4,
      endMonth: 7,
    });
    // The two-digit week number must not be mistaken for a day: "10" is not
    // followed by a period, so the scan moves past it to the real range.
    expect(parseGermanDateRangeSectionName('Woche 10: 23. Juni - 27. Juni')).toEqual({
      startDay: 23,
      startMonth: 6,
      endDay: 27,
      endMonth: 6,
    });
  });

  it('does not let a structurally similar phrase shadow a real range later in the name', () => {
    // "1. Woche - 2. Woche" has the right shape but no month names, so the
    // scan keeps going and finds the actual range.
    expect(parseGermanDateRangeSectionName('1. Woche - 2. Woche: 5. Mai - 9. Mai')).toEqual({
      startDay: 5,
      startMonth: 5,
      endDay: 9,
      endMonth: 5,
    });
    // …and on its own it is not a date range at all.
    expect(parseGermanDateRangeSectionName('1. Woche - 2. Woche')).toBeNull();
  });

  it('returns null for topic-named sections (the common case on some courses)', () => {
    expect(parseGermanDateRangeSectionName('Allgemeines')).toBeNull();
    expect(parseGermanDateRangeSectionName('Thema 00 - Einleitung')).toBeNull();
    expect(parseGermanDateRangeSectionName('DMML Klausur')).toBeNull();
    expect(parseGermanDateRangeSectionName('Sprechstunden zur Prüfung')).toBeNull();
  });

  it('requires a whole month word, not a prefix of one', () => {
    expect(parseGermanDateRangeSectionName('13. Aprilx - 19. April')).toBeNull();
  });

  it('returns null for non-string or empty input', () => {
    expect(parseGermanDateRangeSectionName(null)).toBeNull();
    expect(parseGermanDateRangeSectionName(undefined)).toBeNull();
    expect(parseGermanDateRangeSectionName('')).toBeNull();
  });
});

// Trimmed, anonymized fixture based on spikes/moodle-poc/output/course-10-contents.json
// (an old, cross-semester, topic-structured course — no section names parse as
// date ranges anywhere in the real response: 0 of its 15 non-empty sections).
// The section names/numbers and module mixes are real; the folder in
// "Allgemeines" is added (the real section 0 holds only label/forum, so it is
// dropped as item-less in practice) to exercise a surviving item there.
const topicStructuredCourseSections = () => [
  {
    id: 1001,
    name: 'Allgemeines',
    section: 0,
    visible: 1,
    uservisible: true,
    modules: [
      { id: 501, modname: 'label', name: 'Willkommen', visible: 1, uservisible: true },
      { id: 502, modname: 'forum', name: 'Ankündigungen', url: 'https://moodle.example/mod/forum/view.php?id=502', visible: 1, uservisible: true },
      {
        id: 503,
        modname: 'folder',
        name: 'Foliensammlung (WS 2016/17)',
        url: 'https://moodle.example/mod/folder/view.php?id=503',
        visible: 1,
        uservisible: true,
      },
    ],
  },
  {
    id: 1002,
    name: 'Thema 00 - Einleitung',
    section: 3,
    visible: 1,
    uservisible: true,
    modules: [
      { id: 511, modname: 'label', name: 'Übersicht', visible: 1, uservisible: true },
      {
        id: 512,
        modname: 'url',
        name: 'Video: Einführung',
        url: 'https://moodle.example/mod/url/view.php?id=512',
        visible: 1,
        uservisible: true,
      },
      { id: 513, modname: 'quiz', name: 'Selbsttest', visible: 1, uservisible: true },
      {
        id: 514,
        modname: 'resource',
        name: 'Übungsblatt 0',
        url: 'https://moodle.example/mod/resource/view.php?id=514',
        visible: 1,
        uservisible: true,
      },
    ],
  },
];

// Trimmed, anonymized fixture based on spikes/moodle-poc/output/course-1998-contents.json
// (a live, in-progress course with parseable German date-range section names,
// plus real hidden trailing sections).
const dateRangeStructuredCourseSections = () => [
  {
    id: 2001,
    name: 'Allgemeines',
    section: 0,
    visible: 1,
    uservisible: true,
    // Real shape: this section genuinely has ZERO importable modules — only
    // label/forum/choice/assign — exercising the includeEmptyWeeks default.
    modules: [
      { id: 601, modname: 'label', name: 'Grundlegende Informationen', visible: 1, uservisible: true },
      { id: 602, modname: 'forum', name: 'Ankündigungen', url: 'https://moodle.example/mod/forum/view.php?id=602', visible: 1, uservisible: true },
      { id: 603, modname: 'forum', name: 'Forum für organisatorische Fragen', url: 'https://moodle.example/mod/forum/view.php?id=603', visible: 1, uservisible: true },
      { id: 604, modname: 'choice', name: 'Bedarfsabfrage', visible: 1, uservisible: true },
      { id: 605, modname: 'assign', name: 'Evaluation Vorlesung', visible: 1, uservisible: true },
    ],
  },
  {
    id: 2002,
    name: '13. April - 19. April',
    section: 1,
    visible: 1,
    uservisible: true,
    modules: [
      {
        id: 87317,
        modname: 'resource',
        name: '1. Vorlesung: Einführung',
        url: 'https://moodle.example/mod/resource/view.php?id=87317',
        visible: 1,
        uservisible: true,
      },
      {
        id: 87318,
        modname: 'url',
        name: '1. Vorlesung: Aufzeichnung',
        url: 'https://moodle.example/mod/url/view.php?id=87318',
        visible: 1,
        uservisible: true,
      },
      // Real shape: `page` is not in the allowlist and must be dropped.
      {
        id: 87319,
        modname: 'page',
        name: 'Weiteres Material',
        url: 'https://moodle.example/mod/page/view.php?id=87319',
        visible: 1,
        uservisible: true,
      },
      // Synthetic (not present in the real dump, added to exercise
      // module-level visibility filtering inside an otherwise-visible section).
      {
        id: 87399,
        modname: 'resource',
        name: 'Hidden handout',
        url: 'https://moodle.example/mod/resource/view.php?id=87399',
        visible: 0,
        uservisible: true,
      },
    ],
  },
  {
    id: 2003,
    name: '6. Juli - 12. Juli',
    section: 13,
    visible: 1,
    uservisible: true,
    modules: [
      {
        id: 87450,
        modname: 'folder',
        name: 'Übungsmaterial Woche 13',
        url: 'https://moodle.example/mod/folder/view.php?id=87450',
        visible: 1,
        uservisible: true,
      },
    ],
  },
  // Real shape: hidden trailing sections that must never surface as content.
  // The section itself is real (visible:0/uservisible:false at section 14); the
  // resource inside is synthetic — the real one is empty, so only planting an
  // importable module here actually proves nothing leaks out of it.
  {
    id: 2004,
    name: 'DMML Klausur',
    section: 14,
    visible: 0,
    uservisible: false,
    modules: [
      {
        id: 87500,
        modname: 'resource',
        name: 'Klausur (would leak if not filtered)',
        url: 'https://moodle.example/mod/resource/view.php?id=87500',
        visible: 1,
        uservisible: true,
      },
    ],
  },
  {
    id: 2005,
    name: 'Einsicht',
    section: 15,
    visible: 0,
    uservisible: false,
    modules: [],
  },
];

// Trimmed fixture based on spikes/moodle-poc/output/course-43541-contents.json
// — a third real shape the spike doc didn't capture: every week carries a
// parseable German date range, but behind a "Woche N: " prefix. Also the only
// real dump with `scheduler`/`lti`/`choicegroup` modules, and with a *visible*
// section whose modules are all non-importable forums.
const weekPrefixedCourseSections = () => [
  {
    id: 537527,
    name: 'General',
    section: 0,
    visible: 1,
    uservisible: true,
    modules: [
      { id: 1575955, modname: 'label', name: 'Allgemeine Foren', visible: 1, uservisible: true },
      { id: 1519677, modname: 'forum', name: 'Ankündigungen', url: 'https://moodle.example/mod/forum/view.php?id=1519677', visible: 1, uservisible: true },
      {
        id: 1594007,
        modname: 'folder',
        name: 'Vorlesungsfolien',
        url: 'https://moodle.example/mod/folder/view.php?id=1594007',
        visible: 1,
        uservisible: true,
      },
      { id: 1800036, modname: 'scheduler', name: 'Klausureinsicht WiSe 2025/26', url: 'https://moodle.example/mod/scheduler/view.php?id=1800036', visible: 1, uservisible: true },
    ],
  },
  // Hidden section — must never surface.
  {
    id: 559999,
    name: 'Sprechstunden und Übungsforen',
    section: 2,
    visible: 0,
    uservisible: false,
    modules: [],
  },
  // Visible, but every module is a forum → no importable items.
  {
    id: 566612,
    name: 'Sprechstunden zur Prüfung',
    section: 3,
    visible: 1,
    uservisible: true,
    modules: [
      { id: 1608432, modname: 'forum', name: '01, Mo, 8:00-9:40, S202/C110', url: 'https://moodle.example/mod/forum/view.php?id=1608432', visible: 1, uservisible: false },
      { id: 1608449, modname: 'forum', name: '18, Do, 13:30-15:10, S103/223 (englisch)', url: 'https://moodle.example/mod/forum/view.php?id=1608449', visible: 1, uservisible: true },
    ],
  },
  {
    id: 537528,
    name: 'Woche 1: 22. April – 25. April',
    section: 4,
    visible: 1,
    uservisible: true,
    modules: [
      { id: 1575953, modname: 'label', name: 'Vorlesung 1', visible: 1, uservisible: true },
      {
        id: 1571756,
        modname: 'resource',
        name: 'Folien 00 Administratives',
        url: 'https://moodle.example/mod/resource/view.php?id=1571756',
        visible: 1,
        uservisible: true,
      },
      // `lti` (an external-tool lecture recording) is not in the allowlist.
      { id: 1572980, modname: 'lti', name: 'Vorlesung 01 – Administratives', url: 'https://moodle.example/mod/lti/view.php?id=1572980', visible: 1, uservisible: true },
      {
        id: 1575952,
        modname: 'resource',
        name: 'Folien 02a – Sortieren: Insertion Sort',
        url: 'https://moodle.example/mod/resource/view.php?id=1575952',
        visible: 1,
        uservisible: true,
      },
      { id: 1550175, modname: 'choicegroup', name: 'Übungsgruppen-Wahl', url: 'https://moodle.example/mod/choicegroup/view.php?id=1550175', visible: 1, uservisible: true },
    ],
  },
  {
    id: 537538,
    name: 'Woche 11: 30. Juni - 4. Juli',
    section: 14,
    visible: 1,
    uservisible: true,
    modules: [
      {
        id: 1606291,
        modname: 'resource',
        name: 'Folien Vorlesung 15 -- Graphen',
        url: 'https://moodle.example/mod/resource/view.php?id=1606291',
        visible: 1,
        uservisible: true,
      },
    ],
  },
];

describe('mapCourseContents — week-prefixed course (range behind "Woche N: ")', () => {
  it('parses the date range on every prefixed week', () => {
    const { weeks } = mapCourseContents(weekPrefixedCourseSections());
    const w1 = weeks.find((w) => w.moodleSection === 4);
    expect(w1.dateRange).toEqual({ startDay: 22, startMonth: 4, endDay: 25, endMonth: 4 });
    const w11 = weeks.find((w) => w.moodleSection === 14);
    expect(w11.dateRange).toEqual({ startDay: 30, startMonth: 6, endDay: 4, endMonth: 7 });
  });

  it('keeps the section name verbatim, prefix included', () => {
    const { weeks } = mapCourseContents(weekPrefixedCourseSections());
    expect(weeks.find((w) => w.moodleSection === 4).sectionName).toBe('Woche 1: 22. April – 25. April');
  });

  it('drops the hidden section and the forum-only section, keeping three weeks', () => {
    const { weeks } = mapCourseContents(weekPrefixedCourseSections());
    expect(weeks.map((w) => w.moodleSection)).toEqual([0, 4, 14]);
    expect(weeks.some((w) => w.sectionName === 'Sprechstunden und Übungsforen')).toBe(false);
    expect(weeks.some((w) => w.sectionName === 'Sprechstunden zur Prüfung')).toBe(false);
  });

  it('drops scheduler/lti/choicegroup modules alongside label and forum', () => {
    const { weeks } = mapCourseContents(weekPrefixedCourseSections());
    expect(weeks.find((w) => w.moodleSection === 0).items).toEqual([
      { name: 'Vorlesungsfolien', url: 'https://moodle.example/mod/folder/view.php?id=1594007', moodleModuleId: 1594007 },
    ]);
    expect(weeks.find((w) => w.moodleSection === 4).items).toEqual([
      { name: 'Folien 00 Administratives', url: 'https://moodle.example/mod/resource/view.php?id=1571756', moodleModuleId: 1571756 },
      { name: 'Folien 02a – Sortieren: Insertion Sort', url: 'https://moodle.example/mod/resource/view.php?id=1575952', moodleModuleId: 1575952 },
    ]);
  });

  it('still reports dateRange: null for the un-prefixed General section', () => {
    const { weeks } = mapCourseContents(weekPrefixedCourseSections());
    expect(weeks.find((w) => w.moodleSection === 0).dateRange).toBeNull();
  });
});

describe('mapCourseContents — topic-structured course (no parseable dates)', () => {
  it('drops the empty Allgemeines-style section by default and keeps only real weeks', () => {
    const { weeks } = mapCourseContents(topicStructuredCourseSections());
    expect(weeks).toHaveLength(2);
    expect(weeks.map((w) => w.moodleSection)).toEqual([0, 3]);
  });

  it('falls back to raw section order (moodleSection) with dateRange: null throughout', () => {
    const { weeks } = mapCourseContents(topicStructuredCourseSections());
    weeks.forEach((w) => expect(w.dateRange).toBeNull());
  });

  it('filters modules by modname within each surviving section', () => {
    const { weeks } = mapCourseContents(topicStructuredCourseSections());
    const allgemeines = weeks.find((w) => w.moodleSection === 0);
    expect(allgemeines.items).toEqual([
      { name: 'Foliensammlung (WS 2016/17)', url: 'https://moodle.example/mod/folder/view.php?id=503', moodleModuleId: 503 },
    ]);
    const thema00 = weeks.find((w) => w.moodleSection === 3);
    expect(thema00.items).toEqual([
      { name: 'Video: Einführung', url: 'https://moodle.example/mod/url/view.php?id=512', moodleModuleId: 512 },
      { name: 'Übungsblatt 0', url: 'https://moodle.example/mod/resource/view.php?id=514', moodleModuleId: 514 },
    ]);
  });
});

describe('mapCourseContents — date-range-structured course (with real hidden sections)', () => {
  it('drops hidden trailing sections entirely (not even as an empty week)', () => {
    const { weeks } = mapCourseContents(dateRangeStructuredCourseSections());
    expect(weeks.some((w) => w.sectionName === 'DMML Klausur')).toBe(false);
    expect(weeks.some((w) => w.sectionName === 'Einsicht')).toBe(false);
  });

  it('drops the Allgemeines section by default (label/forum/choice/assign only)', () => {
    const { weeks } = mapCourseContents(dateRangeStructuredCourseSections());
    expect(weeks.some((w) => w.moodleSection === 0)).toBe(false);
  });

  it('keeps the Allgemeines section when includeEmptyWeeks is true, with empty items', () => {
    const { weeks } = mapCourseContents(dateRangeStructuredCourseSections(), { includeEmptyWeeks: true });
    const allgemeines = weeks.find((w) => w.moodleSection === 0);
    expect(allgemeines).toBeDefined();
    expect(allgemeines.items).toEqual([]);
  });

  it('attaches a parsed dateRange for sections whose name matches', () => {
    const { weeks } = mapCourseContents(dateRangeStructuredCourseSections());
    const week1 = weeks.find((w) => w.moodleSection === 1);
    expect(week1.dateRange).toEqual({ startDay: 13, startMonth: 4, endDay: 19, endMonth: 4 });
    const week13 = weeks.find((w) => w.moodleSection === 13);
    expect(week13.dateRange).toEqual({ startDay: 6, startMonth: 7, endDay: 12, endMonth: 7 });
  });

  it('drops a module hidden at the module level even inside an otherwise-visible section', () => {
    const { weeks } = mapCourseContents(dateRangeStructuredCourseSections());
    const week1 = weeks.find((w) => w.moodleSection === 1);
    expect(week1.items.some((i) => i.name === 'Hidden handout')).toBe(false);
    // page (id 87319) also dropped — not in the modname allowlist.
    expect(week1.items.some((i) => i.moodleModuleId === 87319)).toBe(false);
    expect(week1.items).toEqual([
      { name: '1. Vorlesung: Einführung', url: 'https://moodle.example/mod/resource/view.php?id=87317', moodleModuleId: 87317 },
      { name: '1. Vorlesung: Aufzeichnung', url: 'https://moodle.example/mod/url/view.php?id=87318', moodleModuleId: 87318 },
    ]);
  });
});

describe('mapCourseContents — edge cases', () => {
  it('returns an empty weeks array for no sections', () => {
    expect(mapCourseContents([])).toEqual({ weeks: [] });
    expect(mapCourseContents(null)).toEqual({ weeks: [] });
    expect(mapCourseContents(undefined)).toEqual({ weeks: [] });
  });

  it('items never carry a week or type field of their own', () => {
    const { weeks } = mapCourseContents(dateRangeStructuredCourseSections());
    weeks.forEach((w) =>
      w.items.forEach((item) => {
        expect(Object.keys(item).sort()).toEqual(['moodleModuleId', 'name', 'url']);
      })
    );
  });
});
