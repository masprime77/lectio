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

  it('returns null for topic-named sections (the common case on some courses)', () => {
    expect(parseGermanDateRangeSectionName('Allgemeines')).toBeNull();
    expect(parseGermanDateRangeSectionName('Thema 00 - Einleitung')).toBeNull();
    expect(parseGermanDateRangeSectionName('DMML Klausur')).toBeNull();
  });

  it('returns null for non-string or empty input', () => {
    expect(parseGermanDateRangeSectionName(null)).toBeNull();
    expect(parseGermanDateRangeSectionName(undefined)).toBeNull();
    expect(parseGermanDateRangeSectionName('')).toBeNull();
  });
});

// Trimmed, anonymized fixture based on spikes/moodle-poc/output/course-10-contents.json
// (an old, cross-semester, topic-structured course — no section names parse as
// date ranges anywhere in the real response).
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
