// Pure row math for the raw per-item Moodle import screen (moodle-raw.tsx).
// Kept out of the component so the two things that are easy to get subtly
// wrong — the flattening order and the section-counted week cascade — are
// plain functions with tests, not behaviour reachable only by tapping a list.
import type { MoodleMappedContent, MoodleMappedItem } from '../../types/lectio-core';

// One flat row per Moodle item, keeping the section it came from: for the
// row's context line, for the week it starts on, and for the cascade, which
// counts in sections rather than rows.
export interface RawRow {
  key: string;
  item: MoodleMappedItem;
  sectionName: string;
  sectionIndex: number;
}

export function flattenItems(mapped: MoodleMappedContent): RawRow[] {
  const rows: RawRow[] = [];
  mapped.weeks.forEach((w, sectionIndex) => {
    w.items.forEach((item, itemIndex) => {
      rows.push({
        // moodleModuleId is only unique within one Moodle instance, so the
        // section + position pair is what guarantees a stable unique key here.
        key: `${w.moodleSection}-${itemIndex}`,
        item,
        sectionName: w.sectionName || `Section ${w.moodleSection}`,
        sectionIndex,
      });
    });
  });
  return rows;
}

// Week strings for every row, taken from its own section's suggestion — the
// initial seed, and what the "Weeks from sections" button restores. A section
// whose name held no parseable date range has no suggestion, so its rows get
// an empty field rather than a made-up number.
export function seedWeeks(
  rows: RawRow[],
  suggestionsBySection: (number | null)[]
): Record<string, string> {
  const out: Record<string, string> = {};
  rows.forEach((r) => {
    const suggested = suggestionsBySection[r.sectionIndex];
    out[r.key] = suggested ? String(suggested) : '';
  });
  return out;
}

// Week strings for every row *below* fromIndex, given the week just typed into
// it. Moodle sections are consecutive weeks but the items inside one are not,
// so the step is the difference in section index, not in row index: items from
// the same section land in the same week and the next section is what
// advances. Rows above fromIndex are never touched — anything already
// corrected up there stays put.
//
// Returns an empty patch for a blank, zero or negative base (mid-edit or
// cleared), so typing into a field can't scatter garbage down the list.
export function cascadeWeeksFrom(
  rows: RawRow[],
  fromIndex: number,
  baseWeek: number,
  totalWeeks: number | undefined
): Record<string, string> {
  const out: Record<string, string> = {};
  const from = rows[fromIndex];
  if (!from || !totalWeeks || !Number.isInteger(baseWeek) || baseWeek < 1) return out;
  for (let j = fromIndex + 1; j < rows.length; j += 1) {
    const step = rows[j].sectionIndex - from.sectionIndex;
    out[rows[j].key] = String(Math.min(totalWeeks, baseWeek + step));
  }
  return out;
}
