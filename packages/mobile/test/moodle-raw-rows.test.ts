// Row math for the raw per-item Moodle import screen. The screen itself needs
// the RN runtime, but these are the parts that are easy to get subtly wrong —
// flattening order and the section-counted week cascade — so they live as pure
// functions and are covered here.
import { describe, it, expect } from 'vitest';
import { mapCourseContents } from '@lectio/core/integrations/moodle';
import { flattenItems, seedWeeks, cascadeWeeksFrom } from '../src/moodle/raw-rows';
import { suggestWeekFromDateRange } from '../src/moodle/suggest-week';
import type { MoodleMappedContent } from '../types/lectio-core';

// Two dated sections plus an undated one, with a non-importable module mixed
// in — the shape mapCourseContents really produces.
const SECTIONS = [
  {
    section: 1,
    name: 'Woche 1: 7. April - 13. April',
    visible: 1,
    modules: [
      { id: 11, modname: 'resource', name: 'Slides 1', visible: 1, url: 'u1' },
      { id: 12, modname: 'url', name: 'Paper A', visible: 1, url: 'u2' },
      { id: 13, modname: 'forum', name: 'Chat', visible: 1, url: 'u3' },
    ],
  },
  {
    section: 2,
    name: 'Woche 2: 14. April - 20. April',
    visible: 1,
    modules: [{ id: 21, modname: 'resource', name: 'Slides 2', visible: 1, url: 'u4' }],
  },
  {
    section: 3,
    name: 'Allgemeines',
    visible: 1,
    modules: [{ id: 31, modname: 'folder', name: 'Handouts', visible: 1, url: 'u5' }],
  },
];

const mapped = mapCourseContents(SECTIONS as any) as MoodleMappedContent;

describe('flattenItems', () => {
  it('produces one row per importable item, in Moodle order', () => {
    const rows = flattenItems(mapped);
    expect(rows.map((r) => r.item.name)).toEqual(['Slides 1', 'Paper A', 'Slides 2', 'Handouts']);
  });

  it('drops nothing the mapper kept and adds nothing it dropped', () => {
    const rows = flattenItems(mapped);
    const mappedTotal = mapped.weeks.reduce((n, w) => n + w.items.length, 0);
    expect(rows).toHaveLength(mappedTotal);
    expect(rows.some((r) => r.item.name === 'Chat')).toBe(false);
  });

  it('keeps each row pointing at the section it came from', () => {
    const rows = flattenItems(mapped);
    expect(rows.map((r) => r.sectionIndex)).toEqual([0, 0, 1, 2]);
    expect(rows[1].sectionName).toBe('Woche 1: 7. April - 13. April');
    expect(rows[3].sectionName).toBe('Allgemeines');
  });

  it('gives every row a unique, stable key', () => {
    const rows = flattenItems(mapped);
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
    expect(flattenItems(mapped).map((r) => r.key)).toEqual(rows.map((r) => r.key));
  });

  it('falls back to the section number when a section has no name', () => {
    const unnamed = mapCourseContents([
      { section: 7, name: '', visible: 1, modules: [{ id: 1, modname: 'resource', name: 'X', visible: 1 }] },
    ] as any) as MoodleMappedContent;
    expect(flattenItems(unnamed)[0].sectionName).toBe('Section 7');
  });
});

describe('seedWeeks', () => {
  const rows = flattenItems(mapped);
  // A 15-week semester starting Monday 7 April 2025 — section 1 is week 1,
  // section 2 is week 2, and "Allgemeines" parses to no date range at all.
  const suggestions = mapped.weeks.map((w) => suggestWeekFromDateRange('2025-04-07', 15, w.dateRange));

  it('gives every item in a section its section’s suggested week', () => {
    expect(suggestions).toEqual([1, 2, null]);
    const seeded = seedWeeks(rows, suggestions);
    expect(rows.map((r) => seeded[r.key])).toEqual(['1', '1', '2', '']);
  });

  it('leaves a section with no parseable date range blank rather than guessing', () => {
    const seeded = seedWeeks(rows, suggestions);
    expect(seeded[rows[3].key]).toBe('');
  });
});

describe('cascadeWeeksFrom', () => {
  const rows = flattenItems(mapped);

  it('advances one week per section, not per row', () => {
    const patch = cascadeWeeksFrom(rows, 0, 3, 15);
    // Row 1 shares section 0 with the edited row, so it stays on 3; the next
    // two sections step to 4 and 5.
    expect(rows.slice(1).map((r) => patch[r.key])).toEqual(['3', '4', '5']);
  });

  it('never touches the edited row or anything above it', () => {
    const patch = cascadeWeeksFrom(rows, 2, 6, 15);
    expect(patch[rows[0].key]).toBeUndefined();
    expect(patch[rows[1].key]).toBeUndefined();
    expect(patch[rows[2].key]).toBeUndefined();
    expect(patch[rows[3].key]).toBe('7');
  });

  it('clamps to the semester length instead of running past it', () => {
    const patch = cascadeWeeksFrom(rows, 0, 15, 15);
    expect(rows.slice(1).map((r) => patch[r.key])).toEqual(['15', '15', '15']);
  });

  it('cascades nothing while the field is blank, zero or negative', () => {
    expect(cascadeWeeksFrom(rows, 0, NaN, 15)).toEqual({});
    expect(cascadeWeeksFrom(rows, 0, 0, 15)).toEqual({});
    expect(cascadeWeeksFrom(rows, 0, -2, 15)).toEqual({});
  });

  it('cascades nothing before the semester length is known', () => {
    expect(cascadeWeeksFrom(rows, 0, 3, undefined)).toEqual({});
  });

  it('is a no-op from the last row', () => {
    expect(cascadeWeeksFrom(rows, rows.length - 1, 3, 15)).toEqual({});
  });
});
