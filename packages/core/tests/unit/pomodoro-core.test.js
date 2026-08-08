import { describe, it, expect } from 'vitest';
import pomodoro from '../../src/pomodoro-core.js';

const settings = (over) => ({ ...pomodoro.DEFAULT_POMODORO_SETTINGS, ...over });

describe('clampPomodoroSettings', () => {
  it('returns the defaults for a missing settings object', () => {
    expect(pomodoro.clampPomodoroSettings()).toEqual(pomodoro.DEFAULT_POMODORO_SETTINGS);
    expect(pomodoro.clampPomodoroSettings(null)).toEqual(pomodoro.DEFAULT_POMODORO_SETTINGS);
  });

  it('fills in defaults for missing or non-numeric fields', () => {
    expect(pomodoro.clampPomodoroSettings({ workMinutes: 50 })).toEqual({
      workMinutes: 50,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      pomodorosUntilLongBreak: 4,
    });
    expect(pomodoro.clampPomodoroSettings({ workMinutes: 'abc', shortBreakMinutes: NaN })).toEqual(
      pomodoro.DEFAULT_POMODORO_SETTINGS
    );
  });

  it('clamps out-of-range values to their bounds', () => {
    expect(
      pomodoro.clampPomodoroSettings({
        workMinutes: 999,
        shortBreakMinutes: 0,
        longBreakMinutes: 500,
        pomodorosUntilLongBreak: -3,
      })
    ).toEqual({
      workMinutes: 180,
      shortBreakMinutes: 1,
      longBreakMinutes: 90,
      pomodorosUntilLongBreak: 1,
    });
  });

  it('leaves valid values untouched and rounds fractional ones', () => {
    const valid = { workMinutes: 30, shortBreakMinutes: 7, longBreakMinutes: 20, pomodorosUntilLongBreak: 3 };
    expect(pomodoro.clampPomodoroSettings(valid)).toEqual(valid);
    expect(pomodoro.clampPomodoroSettings({ workMinutes: 25.4 }).workMinutes).toBe(25);
  });
});

describe('createIdleState', () => {
  it('is idle, stopped and empty', () => {
    expect(pomodoro.createIdleState()).toEqual({
      phase: 'idle',
      secondsRemaining: 0,
      completedPomodoros: 0,
      running: false,
    });
  });
});

describe('startWork', () => {
  it('starts a running work phase from the configured work length', () => {
    expect(pomodoro.startWork(settings({ workMinutes: 25 }))).toEqual({
      phase: 'work',
      secondsRemaining: 1500,
      completedPomodoros: 0,
      running: true,
    });
  });

  it('sanitizes the settings it is given', () => {
    expect(pomodoro.startWork({ workMinutes: 9999 }).secondsRemaining).toBe(180 * 60);
    expect(pomodoro.startWork().secondsRemaining).toBe(25 * 60);
  });
});

describe('tick', () => {
  it('decrements secondsRemaining by one', () => {
    const next = pomodoro.tick({ phase: 'work', secondsRemaining: 300, completedPomodoros: 0, running: true });
    expect(next.secondsRemaining).toBe(299);
    expect(next.phase).toBe('work');
  });

  it('does not mutate the state it is given', () => {
    const state = { phase: 'work', secondsRemaining: 300, completedPomodoros: 0, running: true };
    pomodoro.tick(state);
    expect(state.secondsRemaining).toBe(300);
  });

  it('is a no-op when not running', () => {
    const paused = { phase: 'work', secondsRemaining: 300, completedPomodoros: 0, running: false };
    expect(pomodoro.tick(paused)).toBe(paused);
  });

  it('is a no-op at zero and when idle', () => {
    const done = { phase: 'work', secondsRemaining: 0, completedPomodoros: 1, running: true };
    expect(pomodoro.tick(done)).toBe(done);
    const idle = pomodoro.createIdleState();
    expect(pomodoro.tick(idle)).toBe(idle);
    expect(pomodoro.tick(null)).toBe(null);
  });
});

describe('advancePhase', () => {
  const work = (completedPomodoros) => ({
    phase: 'work',
    secondsRemaining: 0,
    completedPomodoros,
    running: true,
  });

  it('sends the 1st through 3rd pomodoro to a short break', () => {
    for (const completed of [0, 1, 2]) {
      const next = pomodoro.advancePhase(work(completed), settings());
      expect(next).toEqual({
        phase: 'shortBreak',
        secondsRemaining: 5 * 60,
        completedPomodoros: completed + 1,
        running: true,
      });
    }
  });

  it('sends the 4th pomodoro to a long break', () => {
    expect(pomodoro.advancePhase(work(3), settings())).toEqual({
      phase: 'longBreak',
      secondsRemaining: 15 * 60,
      completedPomodoros: 4,
      running: true,
    });
  });

  it('honours a custom pomodorosUntilLongBreak of 2', () => {
    const custom = settings({ pomodorosUntilLongBreak: 2 });
    expect(pomodoro.advancePhase(work(0), custom).phase).toBe('shortBreak');
    expect(pomodoro.advancePhase(work(1), custom).phase).toBe('longBreak');
    expect(pomodoro.advancePhase(work(2), custom).phase).toBe('shortBreak');
    expect(pomodoro.advancePhase(work(3), custom).phase).toBe('longBreak');
  });

  it('sends a short break back to work, keeping the pomodoro count', () => {
    const state = { phase: 'shortBreak', secondsRemaining: 0, completedPomodoros: 2, running: true };
    expect(pomodoro.advancePhase(state, settings())).toEqual({
      phase: 'work',
      secondsRemaining: 25 * 60,
      completedPomodoros: 2,
      running: true,
    });
  });

  it('ends the cycle after a long break', () => {
    const state = { phase: 'longBreak', secondsRemaining: 0, completedPomodoros: 4, running: true };
    expect(pomodoro.advancePhase(state, settings())).toEqual(pomodoro.createIdleState());
  });

  it('returns an idle state for idle or missing input', () => {
    expect(pomodoro.advancePhase(pomodoro.createIdleState(), settings())).toEqual(pomodoro.createIdleState());
    expect(pomodoro.advancePhase(null, settings())).toEqual(pomodoro.createIdleState());
  });
});

describe('ensureStudyTime', () => {
  it('initializes a missing studyTime', () => {
    const course = { id: 'c-1' };
    const st = pomodoro.ensureStudyTime(course);
    expect(st).toEqual({ totalSeconds: 0, sessions: [] });
    expect(course.studyTime).toBe(st);
  });

  it('repairs a malformed studyTime', () => {
    const course = { studyTime: { totalSeconds: 'lots', sessions: 'nope' } };
    expect(pomodoro.ensureStudyTime(course)).toEqual({ totalSeconds: 0, sessions: [] });
    const nonObject = { studyTime: 42 };
    expect(pomodoro.ensureStudyTime(nonObject)).toEqual({ totalSeconds: 0, sessions: [] });
  });

  it('is idempotent and preserves existing data', () => {
    const course = { studyTime: { totalSeconds: 120, sessions: [{ id: 'st-1', seconds: 120 }] } };
    const first = pomodoro.ensureStudyTime(course);
    const second = pomodoro.ensureStudyTime(course);
    expect(second).toBe(first);
    expect(second.totalSeconds).toBe(120);
    expect(second.sessions).toHaveLength(1);
  });
});

describe('getCourseStudySeconds', () => {
  it('returns 0 for a course with no studyTime', () => {
    expect(pomodoro.getCourseStudySeconds({ id: 'c-1' })).toBe(0);
    expect(pomodoro.getCourseStudySeconds(null)).toBe(0);
  });

  it('does not mutate the course it reads', () => {
    const course = { id: 'c-1' };
    pomodoro.getCourseStudySeconds(course);
    expect(course.studyTime).toBeUndefined();
  });

  it('returns the stored total', () => {
    expect(pomodoro.getCourseStudySeconds({ studyTime: { totalSeconds: 900, sessions: [] } })).toBe(900);
  });
});

describe('addStudyTime', () => {
  it('increments the total and appends a session with the given source', () => {
    const course = { id: 'c-1' };
    pomodoro.addStudyTime(course, 1500, { source: 'pomodoro', date: '2026-08-08' });
    expect(course.studyTime.totalSeconds).toBe(1500);
    expect(course.studyTime.sessions).toHaveLength(1);
    expect(course.studyTime.sessions[0]).toMatchObject({
      seconds: 1500,
      source: 'pomodoro',
      date: '2026-08-08',
    });
    expect(course.studyTime.sessions[0].id).toMatch(/^st-/);
    expect(typeof course.studyTime.sessions[0].createdAt).toBe('string');
  });

  it("defaults the source to 'manual' and the date to today", () => {
    const course = { id: 'c-1' };
    pomodoro.addStudyTime(course, 60);
    expect(course.studyTime.sessions[0].source).toBe('manual');
    expect(course.studyTime.sessions[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('accumulates across calls', () => {
    const course = { id: 'c-1' };
    pomodoro.addStudyTime(course, 600);
    pomodoro.addStudyTime(course, 900);
    expect(course.studyTime.totalSeconds).toBe(1500);
    expect(course.studyTime.sessions).toHaveLength(2);
  });

  it('is a no-op for zero, negative or unparseable seconds', () => {
    const course = { id: 'c-1' };
    pomodoro.addStudyTime(course, 0);
    pomodoro.addStudyTime(course, -300);
    pomodoro.addStudyTime(course, 'abc');
    expect(course.studyTime).toBeUndefined();
  });

  it('caps the session log at MAX_SESSIONS, dropping the oldest', () => {
    const course = { id: 'c-1' };
    const extra = 5;
    for (let i = 1; i <= pomodoro.MAX_SESSIONS + extra; i++) {
      pomodoro.addStudyTime(course, i, { source: 'pomodoro' });
    }
    const sessions = course.studyTime.sessions;
    expect(sessions).toHaveLength(pomodoro.MAX_SESSIONS);
    // The first `extra` entries (seconds 1..5) were dropped.
    expect(sessions[0].seconds).toBe(extra + 1);
    expect(sessions[sessions.length - 1].seconds).toBe(pomodoro.MAX_SESSIONS + extra);
    // The running total still counts every session that was ever added.
    const n = pomodoro.MAX_SESSIONS + extra;
    expect(course.studyTime.totalSeconds).toBe((n * (n + 1)) / 2);
  });
});

describe('setStudyTime', () => {
  it('sets the total exactly and logs the positive delta', () => {
    const course = { studyTime: { totalSeconds: 600, sessions: [] } };
    pomodoro.setStudyTime(course, 1800);
    expect(course.studyTime.totalSeconds).toBe(1800);
    expect(course.studyTime.sessions).toHaveLength(1);
    expect(course.studyTime.sessions[0]).toMatchObject({ seconds: 1200, source: 'adjustment' });
    expect(course.studyTime.sessions[0].id).toMatch(/^adj-/);
  });

  it('logs a negative delta when the total is lowered', () => {
    const course = { studyTime: { totalSeconds: 1800, sessions: [] } };
    pomodoro.setStudyTime(course, 600);
    expect(course.studyTime.totalSeconds).toBe(600);
    expect(course.studyTime.sessions[0].seconds).toBe(-1200);
  });

  it('appends no entry when the delta is zero', () => {
    const course = { studyTime: { totalSeconds: 600, sessions: [] } };
    pomodoro.setStudyTime(course, 600);
    expect(course.studyTime.totalSeconds).toBe(600);
    expect(course.studyTime.sessions).toHaveLength(0);
  });

  it('initializes studyTime on a course that has none, and floors at zero', () => {
    const course = { id: 'c-1' };
    pomodoro.setStudyTime(course, -500);
    expect(course.studyTime.totalSeconds).toBe(0);
    expect(course.studyTime.sessions).toHaveLength(0);
  });

  it('caps the session log at MAX_SESSIONS', () => {
    const course = { studyTime: { totalSeconds: 0, sessions: [] } };
    for (let i = 1; i <= pomodoro.MAX_SESSIONS + 3; i++) pomodoro.setStudyTime(course, i);
    expect(course.studyTime.sessions).toHaveLength(pomodoro.MAX_SESSIONS);
    expect(course.studyTime.totalSeconds).toBe(pomodoro.MAX_SESSIONS + 3);
  });
});

describe('formatClock', () => {
  it('formats under an hour as MM:SS', () => {
    expect(pomodoro.formatClock(300)).toBe('05:00');
    expect(pomodoro.formatClock(9)).toBe('00:09');
    expect(pomodoro.formatClock(0)).toBe('00:00');
    expect(pomodoro.formatClock(3599)).toBe('59:59');
  });

  it('formats an hour or more as H:MM:SS', () => {
    expect(pomodoro.formatClock(3600)).toBe('1:00:00');
    expect(pomodoro.formatClock(8100)).toBe('2:15:00');
  });

  it('floors negative input at zero', () => {
    expect(pomodoro.formatClock(-30)).toBe('00:00');
  });
});

describe('formatHoursMinutes', () => {
  it("renders anything under a minute as '0m'", () => {
    expect(pomodoro.formatHoursMinutes(0)).toBe('0m');
    expect(pomodoro.formatHoursMinutes(59)).toBe('0m');
  });

  it('renders minutes only under an hour', () => {
    expect(pomodoro.formatHoursMinutes(300)).toBe('5m');
    expect(pomodoro.formatHoursMinutes(3599)).toBe('59m');
  });

  it('drops the minutes on a whole hour', () => {
    expect(pomodoro.formatHoursMinutes(3600)).toBe('1h');
    expect(pomodoro.formatHoursMinutes(7200)).toBe('2h');
  });

  it('renders hours and minutes together', () => {
    expect(pomodoro.formatHoursMinutes(8100)).toBe('2h 15m');
  });
});

describe('parseHoursMinutesInput', () => {
  it('parses hours and minutes together', () => {
    expect(pomodoro.parseHoursMinutesInput('2h 15m')).toBe(8100);
    expect(pomodoro.parseHoursMinutesInput('2H15M')).toBe(8100);
  });

  it('parses minutes only', () => {
    expect(pomodoro.parseHoursMinutesInput('90m')).toBe(5400);
  });

  it('treats a bare number as minutes', () => {
    expect(pomodoro.parseHoursMinutesInput('45')).toBe(2700);
  });

  it('parses fractional hours', () => {
    expect(pomodoro.parseHoursMinutesInput('1.5h')).toBe(5400);
  });

  it('returns null for empty or unparseable input', () => {
    expect(pomodoro.parseHoursMinutesInput('')).toBeNull();
    expect(pomodoro.parseHoursMinutesInput('   ')).toBeNull();
    expect(pomodoro.parseHoursMinutesInput('garbage')).toBeNull();
    expect(pomodoro.parseHoursMinutesInput(90)).toBeNull();
    expect(pomodoro.parseHoursMinutesInput(null)).toBeNull();
  });
});

// Wall-clock session state. Every case passes an explicit `nowMs` so the
// assertions are deterministic without fake timers.
describe('deadline-based session', () => {
  const T = 1_700_000_000_000; // fixed epoch ms
  const WORK = 25 * 60;
  const SHORT = 5 * 60;
  const LONG = 15 * 60;

  const started = (over) => ({
    ...pomodoro.startSession(settings(), { courseId: 'c1', semesterId: 's1' }, T),
    ...over,
  });

  describe('createIdleSession', () => {
    it('is idle with no deadline, course or semester', () => {
      expect(pomodoro.createIdleSession()).toEqual({
        phase: 'idle',
        endsAt: 0,
        pausedAt: null,
        completedPomodoros: 0,
        courseId: null,
        semesterId: null,
      });
    });
  });

  describe('phaseDurationSeconds', () => {
    it('returns each phase length from the settings', () => {
      expect(pomodoro.phaseDurationSeconds('work', settings())).toBe(WORK);
      expect(pomodoro.phaseDurationSeconds('shortBreak', settings())).toBe(SHORT);
      expect(pomodoro.phaseDurationSeconds('longBreak', settings())).toBe(LONG);
    });

    it('returns 0 for idle and unknown phases', () => {
      expect(pomodoro.phaseDurationSeconds('idle', settings())).toBe(0);
      expect(pomodoro.phaseDurationSeconds('nonsense', settings())).toBe(0);
    });
  });

  describe('startSession', () => {
    it('opens a work phase ending one work length from now', () => {
      expect(pomodoro.startSession(settings(), { courseId: 'c1', semesterId: 's1' }, T)).toEqual({
        phase: 'work',
        endsAt: T + WORK * 1000,
        pausedAt: null,
        completedPomodoros: 0,
        courseId: 'c1',
        semesterId: 's1',
      });
    });

    it('defaults both ids to null for a free-study session', () => {
      const s = pomodoro.startSession(settings(), {}, T);
      expect(s.courseId).toBeNull();
      expect(s.semesterId).toBeNull();
      expect(pomodoro.startSession(settings(), null, T).courseId).toBeNull();
    });
  });

  describe('remainingSeconds', () => {
    it('is the full duration at the moment of starting', () => {
      expect(pomodoro.remainingSeconds(started(), T)).toBe(WORK);
    });

    it('counts down with wall-clock time', () => {
      expect(pomodoro.remainingSeconds(started(), T + 60_000)).toBe(WORK - 60);
    });

    it('floors at zero past the deadline', () => {
      expect(pomodoro.remainingSeconds(started(), T + WORK * 1000)).toBe(0);
      expect(pomodoro.remainingSeconds(started(), T + 10 * WORK * 1000)).toBe(0);
    });

    it('is 0 for an idle session', () => {
      expect(pomodoro.remainingSeconds(pomodoro.createIdleSession(), T)).toBe(0);
      expect(pomodoro.remainingSeconds(null, T)).toBe(0);
    });
  });

  describe('isRunning / isPaused', () => {
    it('an idle session is neither', () => {
      const idle = pomodoro.createIdleSession();
      expect(pomodoro.isRunning(idle)).toBe(false);
      expect(pomodoro.isPaused(idle)).toBe(false);
      expect(pomodoro.isRunning(null)).toBe(false);
      expect(pomodoro.isPaused(null)).toBe(false);
    });

    it('a fresh session is running, not paused', () => {
      expect(pomodoro.isRunning(started())).toBe(true);
      expect(pomodoro.isPaused(started())).toBe(false);
    });

    it('a paused session is paused, not running', () => {
      const paused = pomodoro.pauseSession(started(), T + 60_000);
      expect(pomodoro.isRunning(paused)).toBe(false);
      expect(pomodoro.isPaused(paused)).toBe(true);
    });
  });

  describe('isPhaseComplete', () => {
    it('is false before the deadline', () => {
      expect(pomodoro.isPhaseComplete(started(), T + WORK * 1000 - 1)).toBe(false);
    });

    it('is true at and after the deadline', () => {
      expect(pomodoro.isPhaseComplete(started(), T + WORK * 1000)).toBe(true);
      expect(pomodoro.isPhaseComplete(started(), T + WORK * 1000 + 60_000)).toBe(true);
    });

    it('stays false for a paused session even long past its deadline', () => {
      const paused = pomodoro.pauseSession(started(), T + 60_000);
      expect(pomodoro.isPhaseComplete(paused, T + 10 * WORK * 1000)).toBe(false);
    });

    it('is false for an idle session', () => {
      expect(pomodoro.isPhaseComplete(pomodoro.createIdleSession(), T)).toBe(false);
    });
  });

  describe('pauseSession', () => {
    it('freezes the remaining time no matter how much wall time passes', () => {
      const paused = pomodoro.pauseSession(started(), T + 60_000);
      const atPause = pomodoro.remainingSeconds(paused, T + 60_000);
      expect(atPause).toBe(WORK - 60);
      expect(pomodoro.remainingSeconds(paused, T + 600_000)).toBe(atPause);
      expect(pomodoro.remainingSeconds(paused, T + 86_400_000)).toBe(atPause);
    });

    it('returns an already-paused session unchanged', () => {
      const paused = pomodoro.pauseSession(started(), T + 60_000);
      expect(pomodoro.pauseSession(paused, T + 120_000)).toBe(paused);
    });

    it('returns an idle session unchanged', () => {
      const idle = pomodoro.createIdleSession();
      expect(pomodoro.pauseSession(idle, T)).toBe(idle);
    });
  });

  describe('resumeSession', () => {
    it('pushes the deadline out by exactly the pause length', () => {
      const paused = pomodoro.pauseSession(started(), T + 60_000);
      const resumed = pomodoro.resumeSession(paused, T + 360_000); // 5 min pause
      expect(resumed.endsAt).toBe(paused.endsAt + 300_000);
      expect(resumed.pausedAt).toBeNull();
    });

    it('restores exactly the remaining time held at pause', () => {
      const paused = pomodoro.pauseSession(started(), T + 60_000);
      const held = pomodoro.remainingSeconds(paused, T + 60_000);
      const resumed = pomodoro.resumeSession(paused, T + 360_000);
      expect(pomodoro.remainingSeconds(resumed, T + 360_000)).toBe(held);
    });

    it('returns a running session unchanged', () => {
      const running = started();
      expect(pomodoro.resumeSession(running, T + 60_000)).toBe(running);
    });
  });

  describe('elapsedWorkSeconds', () => {
    it('is 0 at the start of the phase', () => {
      expect(pomodoro.elapsedWorkSeconds(started(), settings(), T)).toBe(0);
    });

    it('tracks wall-clock time into the phase', () => {
      expect(pomodoro.elapsedWorkSeconds(started(), settings(), T + 60_000)).toBe(60);
    });

    it('can never exceed one full work phase', () => {
      expect(pomodoro.elapsedWorkSeconds(started(), settings(), T + WORK * 1000)).toBe(WORK);
      expect(pomodoro.elapsedWorkSeconds(started(), settings(), T + 100 * WORK * 1000)).toBe(WORK);
    });

    it('is 0 during a break phase', () => {
      const onBreak = pomodoro.advanceSession(started(), settings(), T + WORK * 1000);
      expect(onBreak.phase).toBe('shortBreak');
      expect(pomodoro.elapsedWorkSeconds(onBreak, settings(), T + WORK * 1000 + 60_000)).toBe(0);
    });

    it('is 0 for an idle or missing session', () => {
      expect(pomodoro.elapsedWorkSeconds(pomodoro.createIdleSession(), settings(), T)).toBe(0);
      expect(pomodoro.elapsedWorkSeconds(null, settings(), T)).toBe(0);
    });
  });

  describe('advanceSession', () => {
    const N = T + WORK * 1000; // "now" at the end of a work phase

    it('sends the 1st through 3rd pomodoro to a short break', () => {
      for (const completed of [0, 1, 2]) {
        const next = pomodoro.advanceSession(started({ completedPomodoros: completed }), settings(), N);
        expect(next.phase).toBe('shortBreak');
        expect(next.endsAt).toBe(N + SHORT * 1000);
        expect(next.completedPomodoros).toBe(completed + 1);
        expect(next.pausedAt).toBeNull();
      }
    });

    it('sends the 4th pomodoro to a long break', () => {
      const next = pomodoro.advanceSession(started({ completedPomodoros: 3 }), settings(), N);
      expect(next.phase).toBe('longBreak');
      expect(next.endsAt).toBe(N + LONG * 1000);
      expect(next.completedPomodoros).toBe(4);
    });

    it('honours a custom pomodorosUntilLongBreak of 2', () => {
      const custom = settings({ pomodorosUntilLongBreak: 2 });
      expect(pomodoro.advanceSession(started({ completedPomodoros: 0 }), custom, N).phase).toBe(
        'shortBreak'
      );
      expect(pomodoro.advanceSession(started({ completedPomodoros: 1 }), custom, N).phase).toBe(
        'longBreak'
      );
    });

    it('sends a short break back to work, keeping the pomodoro count', () => {
      const onBreak = pomodoro.advanceSession(started(), settings(), N);
      const back = pomodoro.advanceSession(onBreak, settings(), N + SHORT * 1000);
      expect(back.phase).toBe('work');
      expect(back.endsAt).toBe(N + SHORT * 1000 + WORK * 1000);
      expect(back.completedPomodoros).toBe(1);
    });

    it('ends the cycle after a long break', () => {
      const onLong = pomodoro.advanceSession(started({ completedPomodoros: 3 }), settings(), N);
      expect(pomodoro.advanceSession(onLong, settings(), N + LONG * 1000)).toEqual(
        pomodoro.createIdleSession()
      );
    });

    it('carries the course and semester through every non-idle transition', () => {
      let s = started();
      for (let i = 0; i < 3; i++) {
        s = pomodoro.advanceSession(s, settings(), N);
        expect(s.courseId).toBe('c1');
        expect(s.semesterId).toBe('s1');
      }
    });

    it('returns idle for an idle or missing session', () => {
      expect(pomodoro.advanceSession(pomodoro.createIdleSession(), settings(), N)).toEqual(
        pomodoro.createIdleSession()
      );
      expect(pomodoro.advanceSession(null, settings(), N)).toEqual(pomodoro.createIdleSession());
    });
  });

  describe('skipPhase', () => {
    it('mid-phase produces the same result as advanceSession', () => {
      const mid = T + 60_000;
      expect(pomodoro.skipPhase(started(), settings(), mid)).toEqual(
        pomodoro.advanceSession(started(), settings(), mid)
      );
    });

    it('measures the new phase from the skip moment, not the old deadline', () => {
      const skipped = pomodoro.skipPhase(started(), settings(), T + 60_000);
      expect(skipped.phase).toBe('shortBreak');
      expect(skipped.endsAt).toBe(T + 60_000 + SHORT * 1000);
    });
  });

  describe('phaseLabel', () => {
    it('names each phase', () => {
      expect(pomodoro.phaseLabel('work')).toBe('Focus');
      expect(pomodoro.phaseLabel('shortBreak')).toBe('Short break');
      expect(pomodoro.phaseLabel('longBreak')).toBe('Long break');
      expect(pomodoro.phaseLabel('idle')).toBe('Idle');
    });
  });

  describe('rehydrateSession', () => {
    it('collapses malformed input to idle', () => {
      const idle = pomodoro.createIdleSession();
      expect(pomodoro.rehydrateSession(null, T)).toEqual(idle);
      expect(pomodoro.rehydrateSession(undefined, T)).toEqual(idle);
      expect(pomodoro.rehydrateSession({}, T)).toEqual(idle);
      expect(pomodoro.rehydrateSession('work', T)).toEqual(idle);
      expect(pomodoro.rehydrateSession({ phase: 'nonsense', endsAt: T + 1000 }, T)).toEqual(idle);
      expect(pomodoro.rehydrateSession({ phase: 'work', endsAt: 'soon' }, T)).toEqual(idle);
      expect(pomodoro.rehydrateSession({ phase: 'work', endsAt: NaN }, T)).toEqual(idle);
    });

    it('collapses a stored idle session to a fresh idle one', () => {
      expect(pomodoro.rehydrateSession({ phase: 'idle', endsAt: 0 }, T)).toEqual(
        pomodoro.createIdleSession()
      );
    });

    it('round-trips a still-running work session unchanged', () => {
      const live = started();
      expect(pomodoro.rehydrateSession(JSON.parse(JSON.stringify(live)), T + 60_000)).toEqual(live);
    });

    it('round-trips a paused session past its deadline — the pause protects it', () => {
      const paused = pomodoro.pauseSession(started(), T + 60_000);
      const brk = { ...paused, phase: 'shortBreak' };
      expect(pomodoro.rehydrateSession(brk, T + 10 * WORK * 1000)).toEqual(brk);
    });

    it('collapses a break that expired while the app was closed', () => {
      const onBreak = pomodoro.advanceSession(started(), settings(), T + WORK * 1000);
      expect(pomodoro.rehydrateSession(onBreak, onBreak.endsAt + 1000)).toEqual(
        pomodoro.createIdleSession()
      );
    });

    it('returns an expired work phase as-is so its time can still be credited', () => {
      const live = started();
      const back = pomodoro.rehydrateSession(live, T + 10 * WORK * 1000);
      expect(back).toEqual(live);
      expect(pomodoro.elapsedWorkSeconds(back, settings(), T + 10 * WORK * 1000)).toBe(WORK);
    });

    it('normalizes a bad completedPomodoros to 0 and drops non-string ids', () => {
      const raw = {
        phase: 'work',
        endsAt: T + WORK * 1000,
        pausedAt: null,
        completedPomodoros: -3,
        courseId: 42,
        semesterId: null,
      };
      const back = pomodoro.rehydrateSession(raw, T);
      expect(back.completedPomodoros).toBe(0);
      expect(back.courseId).toBeNull();
      expect(pomodoro.rehydrateSession({ ...raw, completedPomodoros: 'two' }, T).completedPomodoros).toBe(0);
      expect(pomodoro.rehydrateSession({ ...raw, completedPomodoros: 2.7 }, T).completedPomodoros).toBe(2);
    });
  });
});
