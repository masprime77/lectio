import { describe, it, expect } from 'vitest';
import core from '../../src/planner-core.js';

const sample = () => ({
  id: 'ss2025',
  name: 'Summer Semester 2025',
  startDate: '2025-04-07',
  weeks: 15,
  courses: [
    { id: 'c1', name: 'Algorithms', color: '#111', readings: [], tasks: [] },
    { id: 'c2', name: 'Databases', color: '#222', readings: [], tasks: [] },
  ],
});

describe('semester structure', () => {
  it('loading a semester exposes the correct course structure', () => {
    const sem = sample();
    expect(Array.isArray(core.getCourses(sem))).toBe(true);
    expect(core.getCourses(sem)).toHaveLength(2);
    expect(core.getCourses(sem)[0]).toMatchObject({ id: 'c1', name: 'Algorithms' });
  });

  it('a semester with no courses returns an empty array', () => {
    expect(core.getCourses({ id: 'x', name: 'x' })).toEqual([]);
    expect(core.getCourses({ courses: [] })).toEqual([]);
  });
});

describe('course operations', () => {
  it('adding a course generates a unique id', () => {
    const sem = { courses: [] };
    const a = core.addCourse(sem, { name: 'A', color: '#1' });
    const b = core.addCourse(sem, { name: 'B', color: '#2' });
    expect(a.id).not.toBe(b.id);
    expect(sem.courses).toHaveLength(2);
    expect(a.readings).toEqual([]);
    expect(a.tasks).toEqual([]);
  });

  it('deleting a course removes it from the list', () => {
    const sem = sample();
    expect(core.deleteCourse(sem, 'c1')).toBe(true);
    expect(core.getCourses(sem).map((c) => c.id)).toEqual(['c2']);
  });

  it('deleting a course that does not exist is a no-op', () => {
    const sem = sample();
    expect(core.deleteCourse(sem, 'nope')).toBe(false);
    expect(core.getCourses(sem)).toHaveLength(2);
  });

  it('editing a course name updates only that course', () => {
    const sem = sample();
    core.editCourseName(sem, 'c1', 'Advanced Algorithms');
    expect(sem.courses[0].name).toBe('Advanced Algorithms');
    expect(sem.courses[1].name).toBe('Databases');
  });

  it('editing a course color changes only the color and returns the course', () => {
    const sem = sample();
    const course = core.editCourseColor(sem, 'c1', '#abc');
    expect(course).toBe(sem.courses[0]);
    expect(sem.courses[0]).toMatchObject({ id: 'c1', name: 'Algorithms', color: '#abc' });
    expect(sem.courses[1].color).toBe('#222');
  });

  it('editing the color of an unknown course returns null', () => {
    const sem = sample();
    expect(core.editCourseColor(sem, 'nope', '#abc')).toBeNull();
  });

  it('reordering courses applies the given order in place', () => {
    const sem = sample();
    const ref = sem.courses;
    core.reorderCourses(sem, ['c2', 'c1']);
    expect(sem.courses.map((c) => c.id)).toEqual(['c2', 'c1']);
    expect(sem.courses).toBe(ref); // mutated in place, same array reference
  });

  it('reordering drops unknown ids and appends omitted courses', () => {
    const sem = sample();
    core.reorderCourses(sem, ['nope', 'c2']);
    expect(sem.courses.map((c) => c.id)).toEqual(['c2', 'c1']);
  });
});
