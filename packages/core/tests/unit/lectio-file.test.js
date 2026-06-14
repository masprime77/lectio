import { describe, it, expect } from 'vitest';
import lectioFile from '../../src/integrations/lectio-file.js';

const {
  LECTIO_FILE_VERSION,
  buildSemesterFile,
  buildCourseFile,
  cleanCourse,
  parseSemesterFile,
  parseCourseFile,
  withResetStatuses,
  slugify,
  uniqueSemesterId,
  prepareImportedCourse,
} = lectioFile;

const sampleCourse = () => ({
  id: 'c1',
  name: 'Algorithms',
  color: '#4A90D9',
  readings: [
    { id: 'r-1', week: 1, title: 'Intro', status: 'r-studied', extra: 'drop me' },
  ],
  tasks: [
    { id: 't-1', week: 2, title: 'PS1', dueDate: '2025-04-14', status: 't-done', extra: 'drop me' },
  ],
});

const sampleSemester = () => ({
  id: 'ss2025',
  name: 'Summer Semester 2025',
  startDate: '2025-04-07',
  weeks: 15,
  courses: [sampleCourse()],
  readingTags: [{ id: 'r-pending', name: 'pending', color: '#ef4444', section: 'pending' }],
  taskTags: [{ id: 't-pending', name: 'pending', color: '#ef4444', section: 'pending' }],
});

describe('build (export) envelopes', () => {
  it('wraps a semester in the versioned envelope as-is (tags included)', () => {
    const sem = sampleSemester();
    const file = buildSemesterFile(sem);
    expect(file).toEqual({ _lectioType: 'semester', _version: LECTIO_FILE_VERSION, semester: sem });
    expect(LECTIO_FILE_VERSION).toBe(1);
    expect(file.semester.readingTags).toBeDefined();
    expect(file.semester).toBe(sem); // passed through, not cloned
  });

  it('wraps a course in the versioned envelope and cleans extra fields', () => {
    const file = buildCourseFile(sampleCourse());
    expect(file._lectioType).toBe('course');
    expect(file._version).toBe(1);
    expect(file.course.readings[0]).toEqual({ id: 'r-1', week: 1, title: 'Intro', status: 'r-studied' });
    expect(file.course.tasks[0]).toEqual({
      id: 't-1',
      week: 2,
      title: 'PS1',
      dueDate: '2025-04-14',
      status: 't-done',
    });
    expect(file.course.readings[0]).not.toHaveProperty('extra');
    expect(file.course.tasks[0]).not.toHaveProperty('extra');
  });

  it('cleanCourse tolerates missing readings/tasks arrays', () => {
    const clean = cleanCourse({ id: 'c2', name: 'Empty', color: '#000' });
    expect(clean.readings).toEqual([]);
    expect(clean.tasks).toEqual([]);
  });

  it('a built course file round-trips through parse', () => {
    const file = buildCourseFile(sampleCourse());
    expect(parseCourseFile(file).name).toBe('Algorithms');
  });
});

describe('parse (import) validation', () => {
  it('parseSemesterFile returns the inner semester for a valid payload', () => {
    const sem = sampleSemester();
    expect(parseSemesterFile(buildSemesterFile(sem))).toBe(sem);
  });

  it('parseSemesterFile rejects the wrong type', () => {
    expect(() => parseSemesterFile(null)).toThrow('not a Lectio semester export');
    expect(() => parseSemesterFile({ _lectioType: 'course' })).toThrow('not a Lectio semester export');
  });

  it('parseSemesterFile rejects a corrupt inner semester', () => {
    expect(() => parseSemesterFile({ _lectioType: 'semester' })).toThrow('corrupt or invalid');
    expect(() => parseSemesterFile({ _lectioType: 'semester', semester: { id: 'x' } })).toThrow(
      'corrupt or invalid'
    );
    expect(() =>
      parseSemesterFile({ _lectioType: 'semester', semester: { courses: [] } })
    ).toThrow('corrupt or invalid');
  });

  it('parseCourseFile returns the inner course for a valid payload', () => {
    const course = sampleCourse();
    expect(parseCourseFile({ _lectioType: 'course', _version: 1, course })).toBe(course);
  });

  it('parseCourseFile rejects the wrong type', () => {
    expect(() => parseCourseFile(undefined)).toThrow('not a Lectio course export');
    expect(() => parseCourseFile({ _lectioType: 'semester' })).toThrow('not a Lectio course export');
  });

  it('parseCourseFile rejects a course with no name', () => {
    expect(() => parseCourseFile({ _lectioType: 'course' })).toThrow('corrupt or invalid');
    expect(() => parseCourseFile({ _lectioType: 'course', course: { id: 'c1' } })).toThrow(
      'corrupt or invalid'
    );
  });
});

describe('withResetStatuses', () => {
  it('resets every reading/task to its default pending tag without mutating input', () => {
    const sem = sampleSemester();
    const reset = withResetStatuses(sem);
    expect(reset.courses[0].readings[0].status).toBe('r-pending');
    expect(reset.courses[0].tasks[0].status).toBe('t-pending');
    // input untouched
    expect(sem.courses[0].readings[0].status).toBe('r-studied');
    expect(sem.courses[0].tasks[0].status).toBe('t-done');
  });

  it('tolerates a course missing readings/tasks', () => {
    const sem = { id: 's', name: 's', courses: [{ id: 'c', name: 'c' }] };
    expect(() => withResetStatuses(sem)).not.toThrow();
  });
});

describe('slugify / uniqueSemesterId', () => {
  it('slugifies names and falls back to "semester"', () => {
    expect(slugify('Summer Semester 2025')).toBe('summer-semester-2025');
    expect(slugify('  !!!  ')).toBe('semester');
  });

  it('returns the bare slug when there is no collision', () => {
    expect(uniqueSemesterId('Fall 2025', [])).toBe('fall-2025');
    expect(uniqueSemesterId('Fall 2025')).toBe('fall-2025');
  });

  it('appends -2, -3, … on collisions (array or Set)', () => {
    expect(uniqueSemesterId('Fall 2025', ['fall-2025'])).toBe('fall-2025-2');
    expect(uniqueSemesterId('Fall 2025', new Set(['fall-2025', 'fall-2025-2']))).toBe('fall-2025-3');
  });
});

describe('prepareImportedCourse', () => {
  it('assigns fresh ids to the course and every item via the injected maker', () => {
    let n = 0;
    const makeId = (prefix) => `${prefix}-${++n}`;
    const out = prepareImportedCourse(sampleCourse(), makeId);
    expect(out.id).toBe('course-1');
    expect(out.readings[0].id).toBe('r-2');
    expect(out.tasks[0].id).toBe('t-3');
    // non-id fields preserved
    expect(out.readings[0].title).toBe('Intro');
    expect(out.tasks[0].dueDate).toBe('2025-04-14');
  });

  it('defaults the color and tolerates missing arrays', () => {
    const makeId = (p) => `${p}-x`;
    const out = prepareImportedCourse({ name: 'Bare' }, makeId);
    expect(out.color).toBe('#4A90D9');
    expect(out.readings).toEqual([]);
    expect(out.tasks).toEqual([]);
  });

  it('uses core uid when no id maker is supplied', () => {
    const out = prepareImportedCourse(sampleCourse());
    expect(out.id).toMatch(/^course-/);
    expect(out.readings[0].id).toMatch(/^r-/);
    expect(out.tasks[0].id).toMatch(/^t-/);
    // fresh ids differ from the originals
    expect(out.readings[0].id).not.toBe('r-1');
  });
});
