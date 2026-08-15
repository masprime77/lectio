// Same suggestion heuristic as desktop's suggestWeekFromDateRange (app.js):
// given a semester's start date and a Moodle section's parsed date range (day
// + month, no year), guess which 1-based Lectio week that section falls in.
//
// It lives here rather than in @lectio/core because it's UI-suggestion logic,
// not a reusable pure transform — but both the per-section triage screen and
// the raw per-item screen seed their week fields from it, so it lives in one
// place rather than being copied into each.
import type { MoodleWeek } from '../../types/lectio-core';

export function suggestWeekFromDateRange(
  startDate: string | undefined,
  totalWeeks: number | undefined,
  dateRange: MoodleWeek['dateRange']
): number | null {
  if (!dateRange || !startDate || !totalWeeks) return null;
  const start = new Date(startDate + 'T00:00:00');
  const startYear = start.getFullYear();
  const candidates = [startYear, startYear + 1].map(
    (year) => new Date(year, dateRange.startMonth - 1, dateRange.startDay)
  );
  let sectionDate = candidates.find((d) => d >= start);
  if (!sectionDate) sectionDate = candidates[0];
  const diffDays = Math.floor((sectionDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const week = Math.floor(diffDays / 7) + 1;
  return Math.max(1, Math.min(totalWeeks, week));
}
