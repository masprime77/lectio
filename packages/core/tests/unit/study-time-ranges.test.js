import { describe, it, expect } from 'vitest';
import pomodoro from '../../src/pomodoro-core.js';

const {
  localDateKey,
  isValidDateKey,
  addDaysToKey,
  weekStartKey,
  dateKeysBetween,
  studyDayRange,
  studyWeekRange,
  studyLogCutoffKey,
  studyTimeInRange,
  studyTimeByDay,
  pruneStudySessions,
  STUDY_LOG_WEEKS,
} = pomodoro;

// A session log entry as the buckets store them.
const entry = (date, seconds, source = 'pomodoro') => ({
  id: `st-${date}-${seconds}`,
  seconds,
  source,
  date,
  createdAt: `${date}T12:00:00.000Z`,
});

const semesterWith = (courseSessions, freeSessions = []) => ({
  id: 'ss2025',
  courses: [
    {
      id: 'c1',
      name: 'Algorithms',
      color: '#4A90D9',
      studyTime: {
        totalSeconds: courseSessions.reduce((s, e) => s + e.seconds, 0),
        sessions: courseSessions,
      },
    },
  ],
  freeStudy: {
    totalSeconds: freeSessions.reduce((s, e) => s + e.seconds, 0),
    sessions: freeSessions,
  },
});

describe('localDateKey', () => {
  it('formats a local date, not a UTC one', () => {
    // 2025-04-07 23:30 local — the UTC slice would read 04-08 east of GMT.
    const d = new Date(2025, 3, 7, 23, 30, 0);
    expect(localDateKey(d)).toBe('2025-04-07');
  });

  it('accepts epoch ms and falls back to now for nonsense', () => {
    const d = new Date(2025, 0, 2, 9, 0, 0);
    expect(localDateKey(d.getTime())).toBe('2025-01-02');
    expect(isValidDateKey(localDateKey(new Date('nope')))).toBe(true);
  });

  it('zero-pads single-digit months and days', () => {
    expect(localDateKey(new Date(2025, 0, 5))).toBe('2025-01-05');
  });
});

describe('isValidDateKey', () => {
  it('accepts real dates and rejects malformed or impossible ones', () => {
    expect(isValidDateKey('2025-04-07')).toBe(true);
    expect(isValidDateKey('2024-02-29')).toBe(true);
    expect(isValidDateKey('2025-02-30')).toBe(false);
    expect(isValidDateKey('2025-13-01')).toBe(false);
    expect(isValidDateKey('2025-4-7')).toBe(false);
    expect(isValidDateKey('')).toBe(false);
    expect(isValidDateKey(null)).toBe(false);
    expect(isValidDateKey(20250407)).toBe(false);
  });
});

describe('addDaysToKey', () => {
  it('crosses month and year boundaries', () => {
    expect(addDaysToKey('2025-01-31', 1)).toBe('2025-02-01');
    expect(addDaysToKey('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDaysToKey('2025-03-01', -1)).toBe('2025-02-28');
  });

  it('returns null for a malformed key', () => {
    expect(addDaysToKey('nope', 1)).toBeNull();
  });
});

describe('weekStartKey', () => {
  it('returns the Monday on or before the date', () => {
    // 2025-04-07 is a Monday; 04-13 the Sunday that closes that week.
    expect(weekStartKey('2025-04-07')).toBe('2025-04-07');
    expect(weekStartKey('2025-04-09')).toBe('2025-04-07');
    expect(weekStartKey('2025-04-13')).toBe('2025-04-07');
    expect(weekStartKey('2025-04-14')).toBe('2025-04-14');
  });

  it('returns null for a malformed key', () => {
    expect(weekStartKey('2025-99-99')).toBeNull();
  });
});

describe('dateKeysBetween', () => {
  it('is inclusive of both ends', () => {
    expect(dateKeysBetween('2025-04-07', '2025-04-09')).toEqual([
      '2025-04-07',
      '2025-04-08',
      '2025-04-09',
    ]);
    expect(dateKeysBetween('2025-04-07', '2025-04-07')).toEqual(['2025-04-07']);
  });

  it('is empty for an inverted or malformed range', () => {
    expect(dateKeysBetween('2025-04-09', '2025-04-07')).toEqual([]);
    expect(dateKeysBetween('x', '2025-04-07')).toEqual([]);
  });
});

describe('study ranges', () => {
  // A Wednesday, 14:00 local.
  const now = new Date(2025, 3, 9, 14, 0, 0).getTime();

  it('studyDayRange covers a single day', () => {
    expect(studyDayRange(0, now)).toEqual({ from: '2025-04-09', to: '2025-04-09' });
    expect(studyDayRange(-1, now)).toEqual({ from: '2025-04-08', to: '2025-04-08' });
  });

  it('studyWeekRange runs Monday to Sunday', () => {
    expect(studyWeekRange(0, now)).toEqual({ from: '2025-04-07', to: '2025-04-13' });
    expect(studyWeekRange(-1, now)).toEqual({ from: '2025-03-31', to: '2025-04-06' });
    expect(studyWeekRange(-3, now)).toEqual({ from: '2025-03-17', to: '2025-03-23' });
  });

  it('studyLogCutoffKey keeps four weeks by default', () => {
    expect(STUDY_LOG_WEEKS).toBe(4);
    expect(studyLogCutoffKey(now)).toBe('2025-03-17');
    expect(studyLogCutoffKey(now, 1)).toBe('2025-04-07');
    expect(studyLogCutoffKey(now, 2)).toBe('2025-03-31');
  });
});

describe('studyTimeInRange', () => {
  const semester = semesterWith(
    [entry('2025-04-07', 1500), entry('2025-04-09', 3000), entry('2025-03-01', 9000)],
    [entry('2025-04-09', 600)]
  );

  it('sums only the entries inside the range', () => {
    const day = studyTimeInRange(semester, '2025-04-09', '2025-04-09');
    expect(day.totalSeconds).toBe(3600);
    expect(day.courses.map((c) => [c.id, c.seconds])).toEqual([
      ['c1', 3000],
      [pomodoro.FREE_STUDY_ID, 600],
    ]);
  });

  it('flags free study and carries course colour and name', () => {
    const [course, free] = studyTimeInRange(semester, '2025-04-09', '2025-04-09').courses;
    expect(course).toMatchObject({ name: 'Algorithms', color: '#4A90D9', freeStudy: false });
    expect(free).toMatchObject({ name: pomodoro.FREE_STUDY_NAME, freeStudy: true });
  });

  it('computes share and percent over the range total', () => {
    const week = studyTimeInRange(semester, '2025-04-07', '2025-04-13');
    expect(week.totalSeconds).toBe(5100);
    expect(week.courses[0].seconds).toBe(4500);
    expect(week.courses[0].percent).toBe(88);
    expect(week.courses[0].share).toBeCloseTo(4500 / 5100, 6);
  });

  it('leaves out categories with nothing in the range', () => {
    const week = studyTimeInRange(semester, '2025-03-31', '2025-04-06');
    expect(week).toEqual({ totalSeconds: 0, courses: [] });
  });

  it('excludes hand-edit adjustments — those only move the all-time total', () => {
    const sem = semesterWith([entry('2025-04-09', 1200), entry('2025-04-09', 7200, 'adjustment')]);
    expect(studyTimeInRange(sem, '2025-04-09', '2025-04-09').totalSeconds).toBe(1200);
  });

  it('includes manually logged entries on the date they carry', () => {
    const sem = semesterWith([entry('2025-04-08', 5400, 'manual')]);
    expect(studyTimeInRange(sem, '2025-04-08', '2025-04-08').totalSeconds).toBe(5400);
    expect(studyTimeInRange(sem, '2025-04-09', '2025-04-09').totalSeconds).toBe(0);
  });

  it('ignores entries with an unusable date', () => {
    const sem = semesterWith([entry('nope', 1200), { seconds: 600, source: 'pomodoro' }]);
    expect(studyTimeInRange(sem, '2025-04-01', '2025-12-31').totalSeconds).toBe(0);
  });

  it('is empty for a malformed, inverted or absent input', () => {
    expect(studyTimeInRange(semester, '2025-04-13', '2025-04-07')).toEqual({
      totalSeconds: 0,
      courses: [],
    });
    expect(studyTimeInRange(semester, 'x', 'y')).toEqual({ totalSeconds: 0, courses: [] });
    expect(studyTimeInRange(null, '2025-04-07', '2025-04-13')).toEqual({
      totalSeconds: 0,
      courses: [],
    });
  });

  it('does not mutate the semester', () => {
    const snapshot = JSON.stringify(semester);
    studyTimeInRange(semester, '2025-04-07', '2025-04-13');
    expect(JSON.stringify(semester)).toBe(snapshot);
  });
});

describe('studyTimeByDay', () => {
  it('gap-fills every day in the range', () => {
    const semester = semesterWith([entry('2025-04-07', 1500), entry('2025-04-09', 600)]);
    const days = studyTimeByDay(semester, '2025-04-07', '2025-04-13');
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.totalSeconds)).toEqual([1500, 0, 600, 0, 0, 0, 0]);
    expect(days[0].date).toBe('2025-04-07');
    expect(days[6].date).toBe('2025-04-13');
  });

  it('is empty for a malformed range', () => {
    expect(studyTimeByDay(semesterWith([]), 'x', 'y')).toEqual([]);
  });
});

describe('pruneStudySessions', () => {
  const now = new Date(2025, 3, 9, 14, 0, 0).getTime(); // cutoff 2025-03-17

  it('drops entries older than the kept window but never the totals', () => {
    const semester = semesterWith(
      [entry('2025-01-05', 9000), entry('2025-03-17', 1500), entry('2025-04-09', 600)],
      [entry('2025-02-01', 300), entry('2025-04-09', 600)]
    );
    const totalBefore = semester.courses[0].studyTime.totalSeconds;
    const freeBefore = semester.freeStudy.totalSeconds;

    expect(pruneStudySessions(semester, now)).toBe(2);
    expect(semester.courses[0].studyTime.sessions.map((e) => e.date)).toEqual([
      '2025-03-17',
      '2025-04-09',
    ]);
    expect(semester.freeStudy.sessions.map((e) => e.date)).toEqual(['2025-04-09']);
    expect(semester.courses[0].studyTime.totalSeconds).toBe(totalBefore);
    expect(semester.freeStudy.totalSeconds).toBe(freeBefore);
  });

  it('drops entries with an unusable date', () => {
    const semester = semesterWith([entry('nope', 100), { seconds: 50, source: 'pomodoro' }]);
    expect(pruneStudySessions(semester, now)).toBe(2);
    expect(semester.courses[0].studyTime.sessions).toEqual([]);
  });

  it('honours a custom window', () => {
    const semester = semesterWith([entry('2025-03-31', 100), entry('2025-04-09', 100)]);
    expect(pruneStudySessions(semester, now, 1)).toBe(1);
    expect(semester.courses[0].studyTime.sessions.map((e) => e.date)).toEqual(['2025-04-09']);
  });

  it('is a no-op on a semester with no buckets or no semester at all', () => {
    expect(pruneStudySessions(null, now)).toBe(0);
    expect(pruneStudySessions({ id: 'x' }, now)).toBe(0);
    expect(pruneStudySessions({ id: 'x', courses: [{ id: 'c' }] }, now)).toBe(0);
  });

  it('is idempotent', () => {
    const semester = semesterWith([entry('2025-01-05', 100), entry('2025-04-09', 100)]);
    expect(pruneStudySessions(semester, now)).toBe(1);
    expect(pruneStudySessions(semester, now)).toBe(0);
  });
});

describe('local dates on written entries', () => {
  it('stamps new sessions with the local date', () => {
    const course = { id: 'c1', name: 'A' };
    pomodoro.addStudyTime(course, 600, { source: 'pomodoro' });
    expect(course.studyTime.sessions[0].date).toBe(localDateKey());
  });

  it('honours an explicit valid date and falls back for an invalid one', () => {
    const course = { id: 'c1', name: 'A' };
    pomodoro.addStudyTime(course, 600, { source: 'manual', date: '2025-04-08' });
    pomodoro.addStudyTime(course, 600, { source: 'manual', date: '2025-02-31' });
    expect(course.studyTime.sessions.map((e) => e.date)).toEqual(['2025-04-08', localDateKey()]);
  });

  it('stamps free-study entries and adjustments the same way', () => {
    const semester = { id: 's', courses: [] };
    pomodoro.addFreeStudyTime(semester, 600, { source: 'manual', date: '2025-04-08' });
    expect(semester.freeStudy.sessions[0].date).toBe('2025-04-08');
    const course = { id: 'c1', name: 'A' };
    pomodoro.setStudyTime(course, 1200);
    expect(course.studyTime.sessions[0]).toMatchObject({
      source: 'adjustment',
      date: localDateKey(),
    });
  });
});
