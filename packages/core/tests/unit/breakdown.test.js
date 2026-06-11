import { describe, it, expect } from 'vitest';
import core from '../../src/planner-core.js';
import cjsCore from '../helpers/require-core.cjs';

const course = (readings, tasks) => ({ readings, tasks });
const semester = () => ({
  readingTags: JSON.parse(JSON.stringify(core.DEFAULT_READING_TAGS)),
  taskTags: JSON.parse(JSON.stringify(core.DEFAULT_TASK_TAGS)),
});

describe('courseBreakdown', () => {
  it('returns the correct done/total split per type for mixed statuses', () => {
    // 2 done readings of 4 (r-summarized + r-studied), 1 done task of 3 (t-done)
    const c = course(
      [
        { status: 'r-pending' },
        { status: 'r-seen' },
        { status: 'r-summarized' },
        { status: 'r-studied' },
      ],
      [{ status: 't-pending' }, { status: 't-done' }, { status: 't-pending' }]
    );
    expect(core.courseBreakdown(c, semester())).toEqual({
      readings: { done: 2, total: 4 },
      tasks: { done: 1, total: 3 },
    });
  });

  it('returns zeros for an empty course', () => {
    expect(core.courseBreakdown(course([], []), semester())).toEqual({
      readings: { done: 0, total: 0 },
      tasks: { done: 0, total: 0 },
    });
  });

  it('counts only *-studied tags in study mode', () => {
    // r-summarized and t-done are in the done section but not "studied".
    const c = course(
      [{ status: 'r-summarized' }, { status: 'r-studied' }],
      [{ status: 't-done' }, { status: 't-studied' }]
    );
    expect(core.courseBreakdown(c, semester(), true)).toEqual({
      readings: { done: 1, total: 2 },
      tasks: { done: 1, total: 2 },
    });
    // Same course with study mode off: all four count as done.
    expect(core.courseBreakdown(c, semester(), false)).toEqual({
      readings: { done: 2, total: 2 },
      tasks: { done: 2, total: 2 },
    });
  });

  it('counts ghost items via their remembered section in normal mode only', () => {
    const c = course(
      [{ status: '__deleted__', _ghostSection: 'done' }],
      [{ status: '__deleted__', _ghostSection: 'done' }]
    );
    expect(core.courseBreakdown(c, semester(), false)).toEqual({
      readings: { done: 1, total: 1 },
      tasks: { done: 1, total: 1 },
    });
    expect(core.courseBreakdown(c, semester(), true)).toEqual({
      readings: { done: 0, total: 1 },
      tasks: { done: 0, total: 1 },
    });
  });

  it('does not count ghosts from a pending-section tag', () => {
    const c = course([{ status: '__deleted__', _ghostSection: 'pending' }], []);
    expect(core.courseBreakdown(c, semester())).toEqual({
      readings: { done: 0, total: 1 },
      tasks: { done: 0, total: 0 },
    });
  });

  it('is exposed on the CommonJS surface (desktop main-process path)', () => {
    const c = course([{ status: 'r-studied' }, { status: 'r-pending' }], [{ status: 't-done' }]);
    expect(cjsCore.courseBreakdown(c, semester())).toEqual({
      readings: { done: 1, total: 2 },
      tasks: { done: 1, total: 1 },
    });
  });
});
