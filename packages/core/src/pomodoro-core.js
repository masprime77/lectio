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

  // ---- Deadline-based timer state -----------------------------------------
  // The tick-based helpers above decrement a counter and assume a reliable
  // 1 Hz caller. These derive everything from wall-clock instead, which is
  // what both UIs actually use: an interval only triggers a repaint, so a
  // throttled or suspended timer (backgrounded app, sleeping laptop) resumes
  // showing the correct remaining time with no catch-up logic.
  //
  // Session shape:
  //   { phase, endsAt, pausedAt, completedPomodoros, awaitingAdvance,
  //     courseId, semesterId }
  //   phase              'idle' | 'work' | 'shortBreak' | 'longBreak'
  //   endsAt             epoch ms when the current phase ends (0 when idle)
  //   pausedAt           epoch ms when paused, or null when running
  //   completedPomodoros work phases finished so far this session
  //   awaitingAdvance    true once the phase has run out and the user has not
  //                      yet confirmed moving on (see markPhaseComplete)
  //   courseId           course to credit, or null for a free-study session
  //   semesterId         semester the session was started against
  // It is a plain JSON-safe object so it can be persisted as-is.
  //
  // A phase never transitions on its own: when its deadline passes the caller
  // parks it with markPhaseComplete() — the session keeps its phase and sits in
  // the awaiting-advance state until the user confirms, at which point
  // confirmAdvance() / advanceSession() performs the actual transition.

  function createIdleSession() {
    return {
      phase: 'idle',
      endsAt: 0,
      pausedAt: null,
      completedPomodoros: 0,
      awaitingAdvance: false,
      courseId: null,
      semesterId: null,
    };
  }

  function phaseDurationSeconds(phase, settings) {
    const s = clampPomodoroSettings(settings);
    if (phase === 'work') return s.workMinutes * 60;
    if (phase === 'shortBreak') return s.shortBreakMinutes * 60;
    if (phase === 'longBreak') return s.longBreakMinutes * 60;
    return 0;
  }

  // Begin a work phase now. `opts` = { courseId, semesterId }.
  function startSession(settings, opts, nowMs) {
    const now = typeof nowMs === 'number' ? nowMs : Date.now();
    const o = opts || {};
    return {
      phase: 'work',
      endsAt: now + phaseDurationSeconds('work', settings) * 1000,
      pausedAt: null,
      completedPomodoros: 0,
      awaitingAdvance: false,
      courseId: o.courseId || null,
      semesterId: o.semesterId || null,
    };
  }

  // Whole seconds left in the current phase, never negative. A paused session
  // freezes at the remaining time it had when it was paused.
  function remainingSeconds(session, nowMs) {
    if (!session || session.phase === 'idle') return 0;
    const now = typeof nowMs === 'number' ? nowMs : Date.now();
    const ref = session.pausedAt != null ? session.pausedAt : now;
    return Math.max(0, Math.ceil((session.endsAt - ref) / 1000));
  }

  // A session parked in the awaiting-advance state is neither running nor
  // paused: its clock is done, it is just waiting on the user.
  function isRunning(session) {
    return !!session && session.phase !== 'idle' && session.pausedAt == null && !session.awaitingAdvance;
  }

  function isPaused(session) {
    return !!session && session.phase !== 'idle' && session.pausedAt != null;
  }

  // True once a running phase has reached its deadline and has not been parked
  // yet — i.e. the caller still owes it a markPhaseComplete() (and, for a work
  // phase, the study-time credit that goes with it). Turns false again once the
  // session is parked, so a polling caller only ever handles a completion once.
  function isPhaseComplete(session, nowMs) {
    if (!isRunning(session)) return false;
    const now = typeof nowMs === 'number' ? nowMs : Date.now();
    return now >= session.endsAt;
  }

  // True while a finished phase is waiting for the user to confirm moving on.
  function isAwaitingAdvance(session) {
    return !!session && session.phase !== 'idle' && session.awaitingAdvance === true;
  }

  // Park a phase whose deadline has passed instead of transitioning: the phase
  // is kept as-is and flagged awaiting-advance, so the UI can ask before moving
  // on. Any session that is not a running, past-deadline one is returned
  // untouched. Callers credit study time at this moment, independently of when
  // the user actually confirms.
  function markPhaseComplete(session, nowMs) {
    if (!isPhaseComplete(session, nowMs)) return session;
    return { ...session, awaitingAdvance: true };
  }

  function pauseSession(session, nowMs) {
    if (!isRunning(session)) return session;
    const now = typeof nowMs === 'number' ? nowMs : Date.now();
    return { ...session, pausedAt: now };
  }

  // Resume by pushing the deadline out by however long the pause lasted, so
  // the remaining time is preserved exactly.
  function resumeSession(session, nowMs) {
    if (!isPaused(session)) return session;
    const now = typeof nowMs === 'number' ? nowMs : Date.now();
    const pausedFor = now - session.pausedAt;
    return { ...session, endsAt: session.endsAt + pausedFor, pausedAt: null };
  }

  // Seconds of work actually elapsed in the current phase. Returns 0 unless
  // the session is in a work phase. Used to credit partial time when a session
  // is stopped early, and clamped to the phase length so a long pause or a
  // clock change can never credit more than one full pomodoro.
  function elapsedWorkSeconds(session, settings, nowMs) {
    if (!session || session.phase !== 'work') return 0;
    const full = phaseDurationSeconds('work', settings);
    const left = remainingSeconds(session, nowMs);
    return Math.max(0, Math.min(full, full - left));
  }

  // Advance to the next phase, keeping the same course/semester. Mirrors
  // advancePhase(): work -> shortBreak, or longBreak every nth pomodoro;
  // shortBreak -> work; longBreak -> idle (one full cycle done). The new phase
  // is measured from `nowMs`, not from the old deadline, so a session parked
  // awaiting advance starts its next phase when the user confirms; the
  // awaiting-advance flag is cleared by the transition.
  function advanceSession(session, settings, nowMs) {
    const s = clampPomodoroSettings(settings);
    const now = typeof nowMs === 'number' ? nowMs : Date.now();
    if (!session || session.phase === 'idle') return createIdleSession();

    const carry = { courseId: session.courseId, semesterId: session.semesterId };

    if (session.phase === 'work') {
      const completed = session.completedPomodoros + 1;
      const nextPhase = completed % s.pomodorosUntilLongBreak === 0 ? 'longBreak' : 'shortBreak';
      return {
        phase: nextPhase,
        endsAt: now + phaseDurationSeconds(nextPhase, s) * 1000,
        pausedAt: null,
        completedPomodoros: completed,
        awaitingAdvance: false,
        ...carry,
      };
    }

    if (session.phase === 'shortBreak') {
      return {
        phase: 'work',
        endsAt: now + phaseDurationSeconds('work', s) * 1000,
        pausedAt: null,
        completedPomodoros: session.completedPomodoros,
        awaitingAdvance: false,
        ...carry,
      };
    }

    // longBreak finished — the configured cycle is complete.
    return createIdleSession();
  }

  // Skip straight to the next phase before its deadline (the "Skip" control).
  // Identical to advanceSession; named separately so call sites read clearly.
  function skipPhase(session, settings, nowMs) {
    return advanceSession(session, settings, nowMs);
  }

  // The user confirmed the "phase done — move on?" prompt: leave the
  // awaiting-advance state by performing the transition. Identical to
  // advanceSession; named separately so call sites read clearly.
  function confirmAdvance(session, settings, nowMs) {
    return advanceSession(session, settings, nowMs);
  }

  // Human label for the current phase, for the timer face.
  function phaseLabel(phase) {
    if (phase === 'work') return 'Focus';
    if (phase === 'shortBreak') return 'Short break';
    if (phase === 'longBreak') return 'Long break';
    return 'Idle';
  }

  // Restores a session read back from storage. Anything malformed, or a
  // session whose break already ended while the app was closed, collapses to
  // idle. A *work* phase that ended while away is returned as-is so the caller
  // can still credit its time before advancing — see the UI parts. A session
  // parked awaiting advance comes back in exactly that state, whatever its
  // phase: the confirmation the user never gave is still pending, so it must
  // neither collapse to idle nor skip ahead.
  function rehydrateSession(raw, nowMs) {
    const now = typeof nowMs === 'number' ? nowMs : Date.now();
    if (!raw || typeof raw !== 'object') return createIdleSession();
    const phases = ['idle', 'work', 'shortBreak', 'longBreak'];
    if (!phases.includes(raw.phase)) return createIdleSession();
    if (raw.phase === 'idle') return createIdleSession();
    if (typeof raw.endsAt !== 'number' || !Number.isFinite(raw.endsAt)) {
      return createIdleSession();
    }
    const session = {
      phase: raw.phase,
      endsAt: raw.endsAt,
      pausedAt: typeof raw.pausedAt === 'number' ? raw.pausedAt : null,
      completedPomodoros:
        typeof raw.completedPomodoros === 'number' && raw.completedPomodoros >= 0
          ? Math.floor(raw.completedPomodoros)
          : 0,
      awaitingAdvance: raw.awaitingAdvance === true,
      courseId: typeof raw.courseId === 'string' ? raw.courseId : null,
      semesterId: typeof raw.semesterId === 'string' ? raw.semesterId : null,
    };
    // A parked phase is still waiting on the user — preserve it as-is.
    if (session.awaitingAdvance) return session;
    // A break that expired while the app was closed is simply over — there is
    // nothing to credit and no value in resuming it.
    if (session.phase !== 'work' && session.pausedAt == null && now >= session.endsAt) {
      return createIdleSession();
    }
    return session;
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
    // tick-based state machine (retained)
    createIdleState,
    startWork,
    tick,
    advancePhase,
    // deadline-based session state
    createIdleSession,
    phaseDurationSeconds,
    startSession,
    remainingSeconds,
    isRunning,
    isPaused,
    isPhaseComplete,
    isAwaitingAdvance,
    markPhaseComplete,
    pauseSession,
    resumeSession,
    elapsedWorkSeconds,
    advanceSession,
    skipPhase,
    confirmAdvance,
    phaseLabel,
    rehydrateSession,
    // study time
    ensureStudyTime,
    getCourseStudySeconds,
    addStudyTime,
    setStudyTime,
    formatClock,
    formatHoursMinutes,
    parseHoursMinutesInput,
  };
});
