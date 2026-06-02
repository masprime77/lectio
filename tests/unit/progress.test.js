import { describe, it, expect } from 'vitest';
import core from '../../lib/planner-core.js';

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
