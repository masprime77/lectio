import { describe, it, expect } from 'vitest';
import core from '../../lib/planner-core.js';

const course = (readings, tasks) => ({ readings, tasks });

describe('courseProgress', () => {
  it('returns 0% for a course with no items', () => {
    expect(core.courseProgress(course([], []))).toBe(0);
  });

  it('calculates correctly when some readings are studied', () => {
    // 2 of 4 readings studied → 50%
    const c = course(
      [{ status: 'studied' }, { status: 'studied' }, { status: 'pending' }, { status: 'seen' }],
      []
    );
    expect(core.courseProgress(c)).toBe(50);
  });

  it('calculates correctly when all tasks are done or reviewed', () => {
    const c = course([], [{ status: 'done' }, { status: 'reviewed' }]);
    expect(core.courseProgress(c)).toBe(100);
  });

  it('calculates the combined progress of mixed readings and tasks', () => {
    // 1 studied reading + 1 done task = 2 of 4 items → 50%
    const c = course(
      [{ status: 'studied' }, { status: 'pending' }],
      [{ status: 'done' }, { status: 'not done' }]
    );
    expect(core.courseProgress(c)).toBe(50);
  });
});
