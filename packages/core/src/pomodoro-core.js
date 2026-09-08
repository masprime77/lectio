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

  // How long an open-ended ("Extra focus") stretch is allowed to be credited
  // for. Open-ended means "until the user says stop", so a laptop closed
  // mid-stretch would otherwise come back claiming days of focus. Eight hours
  // is far past any real sitting and keeps a walked-away session harmless.
  const MAX_OVERTIME_SECONDS = 8 * 3600;

  // Free study — time tracked with no course attached — is its own category in
  // the study-time breakdown, stored on the semester (`semester.freeStudy`)
  // rather than on any course. The id is namespaced so it can never collide
  // with a real course id, which must match [A-Za-z0-9_-]+.
  const FREE_STUDY_ID = '__free__';
  const FREE_STUDY_NAME = 'Free study';
  // A neutral slate, deliberately unlike the course palette: free study is the
  // category that is *not* a course.
  const FREE_STUDY_COLOR = '#8b96a3';

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
  //     overtimeStartedAt, courseId, semesterId }
  //   phase              'idle' | 'work' | 'shortBreak' | 'longBreak'
  //   endsAt             epoch ms when the current phase ends (0 when idle);
  //                      already in the past while the phase runs open-ended
  //   pausedAt           epoch ms when paused, or null when running
  //   completedPomodoros work phases finished so far this session
  //   awaitingAdvance    true once the phase has run out and the user has not
  //                      yet confirmed moving on (see markPhaseComplete)
  //   overtimeStartedAt  epoch ms when the user chose to keep the finished
  //                      phase running open-ended ("Extra focus" / "Extra
  //                      break"), or null. While set the phase has no deadline
  //                      and counts *up*; it ends only when the user advances.
  //                      For a work phase it also marks the start of the
  //                      not-yet-credited stretch — everything before it was
  //                      already banked when the block completed.
  //   courseId           course to credit, or null for free study
  //   semesterId         semester the session was started against — set for
  //                      free study too, since that is credited to the
  //                      semester itself (see addFreeStudyTime)
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
      overtimeStartedAt: null,
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
      overtimeStartedAt: null,
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
    // An open-ended stretch has no deadline to reach — its `endsAt` is already
    // in the past by construction, and only the user ends it.
    if (isOvertime(session)) return false;
    const now = typeof nowMs === 'number' ? nowMs : Date.now();
    return now >= session.endsAt;
  }

  // ---- Open-ended extensions ----------------------------------------------
  // A finished phase can be carried on past its deadline instead of moving to
  // the next one: "Extra focus" keeps a focus block going until the user calls
  // it (and that time is credited), "Extra break" does the same for a break.
  // Both are open-ended — nothing counts down, the phase simply keeps running
  // until advanceSession/skipPhase/stop ends it.

  function isOvertime(session) {
    return (
      !!session && session.phase !== 'idle' && typeof session.overtimeStartedAt === 'number'
    );
  }

  // Whole seconds elapsed in the current open-ended stretch. Freezes while
  // paused (like remainingSeconds) and is capped at MAX_OVERTIME_SECONDS so a
  // session left running for days can never claim days of focus.
  function overtimeSeconds(session, nowMs) {
    if (!isOvertime(session)) return 0;
    const now = typeof nowMs === 'number' ? nowMs : Date.now();
    const ref = session.pausedAt != null ? session.pausedAt : now;
    const elapsed = Math.floor((ref - session.overtimeStartedAt) / 1000);
    return Math.min(MAX_OVERTIME_SECONDS, Math.max(0, elapsed));
  }

  // Carry a finished phase on open-ended. Only ever applies to a session parked
  // awaiting advance — anything else is returned untouched.
  function extendPhase(session, nowMs) {
    if (!isAwaitingAdvance(session)) return session;
    const now = typeof nowMs === 'number' ? nowMs : Date.now();
    return { ...session, awaitingAdvance: false, overtimeStartedAt: now };
  }

  // Give a finished *break* a few more minutes: a fresh deadline, counting down
  // like any other phase, so it completes and asks again when it runs out.
  // Break-only by design — a finished focus block has already been credited in
  // full, and a second deadline-based stretch would credit a second full block;
  // extendPhase() is the (correctly accounted) way to carry focus on.
  function extendPhaseByMinutes(session, minutes, nowMs) {
    if (!isAwaitingAdvance(session)) return session;
    if (session.phase === 'work') return session;
    const now = typeof nowMs === 'number' ? nowMs : Date.now();
    const mins = clampInt(minutes, 1, 90, 5);
    return {
      ...session,
      awaitingAdvance: false,
      overtimeStartedAt: null,
      endsAt: now + mins * 60 * 1000,
    };
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
    return {
      ...session,
      endsAt: session.endsAt + pausedFor,
      // An open-ended stretch freezes while paused too, so its start slides by
      // the same amount — otherwise the pause would be credited as focus.
      overtimeStartedAt:
        session.overtimeStartedAt != null ? session.overtimeStartedAt + pausedFor : null,
      pausedAt: null,
    };
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

  // How much studied time the current work phase still owes, in seconds — the
  // one number every "credit now" call site needs, so none of them has to
  // re-derive which case it is in:
  //   open-ended  the extra stretch since the user chose to keep going (the
  //               block itself was banked in full when it completed)
  //   parked      nothing — a finished block was already credited in full
  //   running     however much of the block has actually elapsed
  // Returns 0 outside a work phase.
  function pendingWorkCreditSeconds(session, settings, nowMs) {
    if (!session || session.phase !== 'work') return 0;
    if (isOvertime(session)) return overtimeSeconds(session, nowMs);
    if (isAwaitingAdvance(session)) return 0;
    return elapsedWorkSeconds(session, settings, nowMs);
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
        overtimeStartedAt: null,
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
        overtimeStartedAt: null,
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

  // Label for a phase carried on open-ended, where "Focus"/"Short break" would
  // read as a countdown that stalled.
  function sessionLabel(session) {
    if (!session || session.phase === 'idle') return 'Idle';
    if (isOvertime(session)) return session.phase === 'work' ? 'Extra focus' : 'Extra break';
    return phaseLabel(session.phase);
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
      overtimeStartedAt:
        typeof raw.overtimeStartedAt === 'number' && Number.isFinite(raw.overtimeStartedAt)
          ? raw.overtimeStartedAt
          : null,
      courseId: typeof raw.courseId === 'string' ? raw.courseId : null,
      semesterId: typeof raw.semesterId === 'string' ? raw.semesterId : null,
    };
    // A parked phase is still waiting on the user — preserve it as-is.
    if (session.awaitingAdvance) return session;
    // An open-ended stretch has no deadline that could have expired: it runs
    // until the user ends it, so it comes back exactly as it was (its credit is
    // capped by overtimeSeconds, so a long absence stays harmless).
    if (session.overtimeStartedAt != null) return session;
    // A break that expired while the app was closed is simply over — there is
    // nothing to credit and no value in resuming it.
    if (session.phase !== 'work' && session.pausedAt == null && now >= session.endsAt) {
      return createIdleSession();
    }
    return session;
  }

  // Lazily initializes a { totalSeconds, sessions } bucket under `key` on
  // `owner`, in place, and returns it. Shared by the per-course bucket
  // (course.studyTime) and the semester-level free-study one
  // (semester.freeStudy) so the two can never drift apart.
  function ensureTimeBucket(owner, key) {
    if (!owner[key] || typeof owner[key] !== 'object') {
      owner[key] = { totalSeconds: 0, sessions: [] };
    }
    const bucket = owner[key];
    if (!Array.isArray(bucket.sessions)) bucket.sessions = [];
    if (typeof bucket.totalSeconds !== 'number' || !Number.isFinite(bucket.totalSeconds)) {
      bucket.totalSeconds = 0;
    }
    return bucket;
  }

  function readBucketSeconds(owner, key) {
    return owner && owner[key] && typeof owner[key].totalSeconds === 'number'
      ? owner[key].totalSeconds
      : 0;
  }

  // Lazily initializes course.studyTime in place and returns it.
  function ensureStudyTime(course) {
    return ensureTimeBucket(course, 'studyTime');
  }

  // Lazily initializes semester.freeStudy in place and returns it. Free study
  // belongs to the semester, not to any course — that is what makes it its own
  // category rather than an untracked hole.
  function ensureFreeStudyTime(semester) {
    return ensureTimeBucket(semester, 'freeStudy');
  }

  // Read-only accessor. Returns 0 for courses without studyTime yet (never
  // mutates, unlike ensureStudyTime).
  function getCourseStudySeconds(course) {
    return readBucketSeconds(course, 'studyTime');
  }

  // Read-only accessor for the semester's free-study total.
  function getFreeStudySeconds(semester) {
    return readBucketSeconds(semester, 'freeStudy');
  }

  // Where a semester's studied time went, ready for a chart or a legend:
  //   { totalSeconds, courses: [{ id, name, color, seconds, share, percent }] }
  // Free study is one of the slices, under FREE_STUDY_ID and flagged
  // `freeStudy: true` — it is a category alongside the courses, not one of
  // them, so a caller that needs to tell them apart can.
  // Categories with no tracked time are left out — an empty slice is noise in a
  // chart, and a caller that wants to list every course already has the
  // semester. What remains is sorted most-studied first. `share` is the exact
  // fraction of totalSeconds; `percent` is that rounded to a whole number, so
  // the percents are labels and may total 99 or 101 rather than exactly 100.
  // A semester with no courses, nothing studied yet, or no semester at all
  // gives { totalSeconds: 0, courses: [] }. Never mutates its argument.
  function studyTimeByCourse(semester) {
    const list = semester && Array.isArray(semester.courses) ? semester.courses : [];
    const tracked = [];
    let totalSeconds = 0;
    list.forEach((course) => {
      const seconds = getCourseStudySeconds(course);
      if (!Number.isFinite(seconds) || seconds <= 0) return;
      totalSeconds += seconds;
      tracked.push({
        id: course.id,
        name: course.name,
        color: course.color || null,
        seconds,
        freeStudy: false,
      });
    });
    const freeSeconds = getFreeStudySeconds(semester);
    if (Number.isFinite(freeSeconds) && freeSeconds > 0) {
      totalSeconds += freeSeconds;
      tracked.push({
        id: FREE_STUDY_ID,
        name: FREE_STUDY_NAME,
        color: FREE_STUDY_COLOR,
        seconds: freeSeconds,
        freeStudy: true,
      });
    }
    tracked.sort((a, b) => b.seconds - a.seconds);
    return {
      totalSeconds,
      courses: tracked.map((c) => ({
        ...c,
        share: c.seconds / totalSeconds,
        percent: Math.round((c.seconds / totalSeconds) * 100),
      })),
    };
  }

  function uidLocal(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  // Appends `secs` (already sanitized) to a { totalSeconds, sessions } bucket.
  function pushBucketSession(bucket, secs, opts) {
    const o = opts || {};
    bucket.totalSeconds += secs;
    bucket.sessions.push({
      id: uidLocal('st'),
      seconds: secs,
      source: o.source || 'manual',
      date: o.date || new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    });
    if (bucket.sessions.length > MAX_SESSIONS) {
      bucket.sessions.splice(0, bucket.sessions.length - MAX_SESSIONS);
    }
    return bucket;
  }

  // Adds `seconds` of studied time to a course, appending a session log entry.
  // source: 'pomodoro' | 'manual'. No-op for seconds <= 0.
  function addStudyTime(course, seconds, opts) {
    const secs = Math.max(0, Math.round(Number(seconds) || 0));
    if (secs <= 0) return course;
    pushBucketSession(ensureStudyTime(course), secs, opts);
    return course;
  }

  // The free-study equivalent: time studied with no course attached, banked on
  // the semester itself. Same log shape and same cap. No-op for seconds <= 0.
  function addFreeStudyTime(semester, seconds, opts) {
    const secs = Math.max(0, Math.round(Number(seconds) || 0));
    if (!semester || secs <= 0) return semester;
    pushBucketSession(ensureFreeStudyTime(semester), secs, opts);
    return semester;
  }

  // Overwrites the course's total studied time directly (used by the manual
  // "edit studied time" UI). Logs the delta as an 'adjustment' session entry so
  // the change stays auditable in the session log.
  function setBucketTotal(bucket, newTotalSeconds) {
    const total = Math.max(0, Math.round(Number(newTotalSeconds) || 0));
    const delta = total - bucket.totalSeconds;
    bucket.totalSeconds = total;
    if (delta !== 0) {
      bucket.sessions.push({
        id: uidLocal('adj'),
        seconds: delta,
        source: 'adjustment',
        date: new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
      });
      if (bucket.sessions.length > MAX_SESSIONS) {
        bucket.sessions.splice(0, bucket.sessions.length - MAX_SESSIONS);
      }
    }
    return bucket;
  }

  function setStudyTime(course, newTotalSeconds) {
    setBucketTotal(ensureStudyTime(course), newTotalSeconds);
    return course;
  }

  // The free-study equivalent, so the semester-level category can be corrected
  // by hand the same way a course's total can.
  function setFreeStudyTime(semester, newTotalSeconds) {
    if (!semester) return semester;
    setBucketTotal(ensureFreeStudyTime(semester), newTotalSeconds);
    return semester;
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
    MAX_OVERTIME_SECONDS,
    FREE_STUDY_ID,
    FREE_STUDY_NAME,
    FREE_STUDY_COLOR,
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
    isOvertime,
    overtimeSeconds,
    markPhaseComplete,
    extendPhase,
    extendPhaseByMinutes,
    pauseSession,
    resumeSession,
    elapsedWorkSeconds,
    pendingWorkCreditSeconds,
    advanceSession,
    skipPhase,
    confirmAdvance,
    phaseLabel,
    sessionLabel,
    rehydrateSession,
    // study time
    ensureStudyTime,
    ensureFreeStudyTime,
    getCourseStudySeconds,
    getFreeStudySeconds,
    studyTimeByCourse,
    addStudyTime,
    addFreeStudyTime,
    setStudyTime,
    setFreeStudyTime,
    formatClock,
    formatHoursMinutes,
    parseHoursMinutesInput,
  };
});
