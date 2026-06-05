import { describe, it, expect } from 'vitest';
import core from '../../src/planner-core.js';

const course = (readings, tasks) => ({ readings, tasks });
const semester = () => ({
  readingTags: JSON.parse(JSON.stringify(core.DEFAULT_READING_TAGS)),
  taskTags: JSON.parse(JSON.stringify(core.DEFAULT_TASK_TAGS)),
});

describe('courseProgress', () => {
  it('returns 0% for a course with no items', () => {
    expect(core.courseProgress(course([], []), semester())).toBe(0);
  });

  it('counts readings whose tag is in the done section', () => {
    // r-studied and r-summarized are "done"; r-pending and r-seen are not → 50%
    const c = course(
      [
        { status: 'r-studied' },
        { status: 'r-summarized' },
        { status: 'r-pending' },
        { status: 'r-seen' },
      ],
      []
    );
    expect(core.courseProgress(c, semester())).toBe(50);
  });

  it('counts tasks whose tag is in the done section', () => {
    const c = course([], [{ status: 't-done' }, { status: 't-studied' }]);
    expect(core.courseProgress(c, semester())).toBe(100);
  });

  it('calculates the combined progress of mixed readings and tasks', () => {
    // 1 done reading + 1 done task = 2 of 4 items → 50%
    const c = course(
      [{ status: 'r-studied' }, { status: 'r-pending' }],
      [{ status: 't-done' }, { status: 't-pending' }]
    );
    expect(core.courseProgress(c, semester())).toBe(50);
  });

  it('counts ghost items via their remembered section', () => {
    const c = course(
      [
        { status: '__deleted__', _ghostSection: 'done' },
        { status: '__deleted__', _ghostSection: 'pending' },
      ],
      []
    );
    expect(core.courseProgress(c, semester())).toBe(50);
  });

  it('falls back to default tags when no semester is given', () => {
    const c = course([{ status: 'r-studied' }, { status: 'r-pending' }], []);
    expect(core.courseProgress(c)).toBe(50);
  });
});

describe('courseProgress with Study Mode', () => {
  it('counts only studied tags for readings and tasks', () => {
    const c = course(
      [{ status: 'r-studied' }, { status: 'r-pending' }],
      [{ status: 't-studied' }, { status: 't-pending' }]
    );
    // 1 studied reading + 1 studied task = 2 of 4 → 50%
    expect(core.courseProgress(c, semester(), true)).toBe(50);
  });

  it('does NOT count other done-section tags when study mode is on', () => {
    // r-summarized is in the done section, but only r-studied counts here.
    const c = course([{ status: 'r-summarized' }, { status: 'r-studied' }], []);
    expect(core.courseProgress(c, semester(), true)).toBe(50);
    // The same course counts both as done when study mode is off.
    expect(core.courseProgress(c, semester(), false)).toBe(100);
  });

  it('never counts pending tags in either mode', () => {
    const c = course([{ status: 'r-pending' }], [{ status: 't-pending' }]);
    expect(core.courseProgress(c, semester(), true)).toBe(0);
    expect(core.courseProgress(c, semester(), false)).toBe(0);
  });

  it('does not count ghost items when study mode is on', () => {
    // A ghost from a deleted done-section tag counts when off, but study mode
    // only counts explicit r-studied/t-studied.
    const c = course([{ status: '__deleted__', _ghostSection: 'done' }], []);
    expect(core.courseProgress(c, semester(), false)).toBe(100);
    expect(core.courseProgress(c, semester(), true)).toBe(0);
  });

  it('omitting the third arg behaves identically to studyMode=false', () => {
    const c = course([{ status: 'r-summarized' }, { status: 'r-pending' }], []);
    expect(core.courseProgress(c, semester())).toBe(
      core.courseProgress(c, semester(), false)
    );
  });
});
