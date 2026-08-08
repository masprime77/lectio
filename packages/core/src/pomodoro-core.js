'use strict';
// Pure Pomodoro timer + study-time logic shared by the renderer (app.js) and
// the test suite. Loaded in the browser via <script> (attaches
// window.PomodoroCore) and in Node / Vitest via require() (module.exports).
// No DOM or Electron deps.
(function (global, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global) global.PomodoroCore = api;
})(typeof window !== 'undefined' ? window : null, function () {
  const DEFAULT_POMODORO_SETTINGS = {
    workMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    pomodorosUntilLongBreak: 4,
  };

  // Cap on stored session log entries per course (oldest dropped first) so
  // the semester JSON never grows unbounded.
  const MAX_SESSIONS = 200;

  function clampInt(n, min, max, fallback) {
    const v = Math.round(Number(n));
    if (!Number.isFinite(v)) return fallback;
    return Math.min(max, Math.max(min, v));
  }

  // Sanitizes a (possibly partial/invalid) settings object into a complete,
  // safe one. Never throws.
  function clampPomodoroSettings(settings) {
    const s = settings || {};
    return {
      workMinutes: clampInt(s.workMinutes, 1, 180, DEFAULT_POMODORO_SETTINGS.workMinutes),
      shortBreakMinutes: clampInt(s.shortBreakMinutes, 1, 60, DEFAULT_POMODORO_SETTINGS.shortBreakMinutes),
      longBreakMinutes: clampInt(s.longBreakMinutes, 1, 90, DEFAULT_POMODORO_SETTINGS.longBreakMinutes),
      pomodorosUntilLongBreak: clampInt(
        s.pomodorosUntilLongBreak,
        1,
        12,
        DEFAULT_POMODORO_SETTINGS.pomodorosUntilLongBreak
      ),
    };
  }

  // Timer state shape: { phase, secondsRemaining, completedPomodoros, running }
  // phase is one of 'idle' | 'work' | 'shortBreak' | 'longBreak'.
  function createIdleState() {
    return { phase: 'idle', secondsRemaining: 0, completedPomodoros: 0, running: false };
  }

  function startWork(settings) {
    const s = clampPomodoroSettings(settings);
    return { phase: 'work', secondsRemaining: s.workMinutes * 60, completedPomodoros: 0, running: true };
  }

  // Advance the clock by one second. No-op when idle or not running.
  function tick(state) {
    if (!state || !state.running || state.secondsRemaining <= 0) return state;
    return { ...state, secondsRemaining: state.secondsRemaining - 1 };
  }

  // Call once secondsRemaining has reached 0. Returns the next state:
  //   work        -> shortBreak, or longBreak every `pomodorosUntilLongBreak`th
  //   shortBreak  -> work
  //   longBreak   -> idle (the configured cycle is complete)
  function advancePhase(state, settings) {
    const s = clampPomodoroSettings(settings);
    if (!state || state.phase === 'idle') return createIdleState();
    if (state.phase === 'work') {
      const completed = state.completedPomodoros + 1;
      const isLongBreak = completed % s.pomodorosUntilLongBreak === 0;
      return {
        phase: isLongBreak ? 'longBreak' : 'shortBreak',
        secondsRemaining: (isLongBreak ? s.longBreakMinutes : s.shortBreakMinutes) * 60,
        completedPomodoros: completed,
        running: true,
      };
    }
    if (state.phase === 'shortBreak') {
      return {
        phase: 'work',
        secondsRemaining: s.workMinutes * 60,
        completedPomodoros: state.completedPomodoros,
        running: true,
      };
    }
    // longBreak just finished: the configured cycle is done.
    return createIdleState();
  }

  // Lazily initializes course.studyTime in place and returns it.
  function ensureStudyTime(course) {
    if (!course.studyTime || typeof course.studyTime !== 'object') {
      course.studyTime = { totalSeconds: 0, sessions: [] };
    }
    if (!Array.isArray(course.studyTime.sessions)) course.studyTime.sessions = [];
    if (typeof course.studyTime.totalSeconds !== 'number' || !Number.isFinite(course.studyTime.totalSeconds)) {
      course.studyTime.totalSeconds = 0;
    }
    return course.studyTime;
  }

  // Read-only accessor. Returns 0 for courses without studyTime yet (never
  // mutates, unlike ensureStudyTime).
  function getCourseStudySeconds(course) {
    return course && course.studyTime && typeof course.studyTime.totalSeconds === 'number'
      ? course.studyTime.totalSeconds
      : 0;
  }

  function uidLocal(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  // Adds `seconds` of studied time to a course, appending a session log entry.
  // source: 'pomodoro' | 'manual'. No-op for seconds <= 0.
  function addStudyTime(course, seconds, opts) {
    const secs = Math.max(0, Math.round(Number(seconds) || 0));
    if (secs <= 0) return course;
    const st = ensureStudyTime(course);
    const o = opts || {};
    st.totalSeconds += secs;
    st.sessions.push({
      id: uidLocal('st'),
      seconds: secs,
      source: o.source || 'manual',
      date: o.date || new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    });
    if (st.sessions.length > MAX_SESSIONS) st.sessions.splice(0, st.sessions.length - MAX_SESSIONS);
    return course;
  }

  // Overwrites the course's total studied time directly (used by the manual
  // "edit studied time" UI). Logs the delta as an 'adjustment' session entry so
  // the change stays auditable in the session log.
  function setStudyTime(course, newTotalSeconds) {
    const st = ensureStudyTime(course);
    const total = Math.max(0, Math.round(Number(newTotalSeconds) || 0));
    const delta = total - st.totalSeconds;
    st.totalSeconds = total;
    if (delta !== 0) {
      st.sessions.push({
        id: uidLocal('adj'),
        seconds: delta,
        source: 'adjustment',
        date: new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
      });
      if (st.sessions.length > MAX_SESSIONS) st.sessions.splice(0, st.sessions.length - MAX_SESSIONS);
    }
    return course;
  }

  // "MM:SS", or "H:MM:SS" once past an hour. For the live timer face.
  function formatClock(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
  }

  // "2h 15m" / "45m" / "0m". For displaying totals (progress bar, course view).
  function formatHoursMinutes(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    if (s < 60) return '0m';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }

  // Parses free text like "2h 15m", "90m", "1.5h", or a bare number (assumed
  // minutes) into whole seconds. Returns null when unparseable.
  function parseHoursMinutesInput(text) {
    if (typeof text !== 'string') return null;
    const trimmed = text.trim().toLowerCase();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10) * 60;
    const hMatch = trimmed.match(/([\d.]+)\s*h/);
    const mMatch = trimmed.match(/([\d.]+)\s*m/);
    if (!hMatch && !mMatch) return null;
    const hours = hMatch ? parseFloat(hMatch[1]) : 0;
    const minutes = mMatch ? parseFloat(mMatch[1]) : 0;
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return Math.round(hours * 3600 + minutes * 60);
  }

  return {
    DEFAULT_POMODORO_SETTINGS,
    MAX_SESSIONS,
    clampPomodoroSettings,
    createIdleState,
    startWork,
    tick,
    advancePhase,
    ensureStudyTime,
    getCourseStudySeconds,
    addStudyTime,
    setStudyTime,
    formatClock,
    formatHoursMinutes,
    parseHoursMinutesInput,
  };
});
