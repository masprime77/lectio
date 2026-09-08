// App-wide Pomodoro timer. Lives in a provider (not a screen) because mobile
// screens unmount as you navigate, while the timer must survive navigation.
//
// The session's `endsAt` is authoritative (see @lectio/core/pomodoro-core), so
// the 1s interval below only triggers a re-render and the AppState listener
// only forces a recompute on foreground — neither has to reconstruct lost time
// after the OS throttles or suspends the app.
//
// Session + durations persist to AsyncStorage via `prefs` (device-local).
// The only thing written into the semester is the resulting studyTime, and
// that goes through saveWithConflict like every other mobile write.
//
// A local (device-scheduled, not push) notification is scheduled for the
// session's endsAt every time it changes, and cancelled/rescheduled on every
// pause, resume, skip and stop via applySession — the one choke point every
// transition already flows through. That's what makes a phase-completion
// alert arrive even when the app is fully backgrounded: it's the OS firing
// the notification it was told about, not this file's JS running late.
// Crediting study time is untouched and still only happens in completePhase;
// the scheduled notification is a pure heads-up and never itself writes
// studyTime, so there's no risk of double-crediting from adding it.
//
// No phase ever advances on its own: completePhase credits and then parks the
// session in core's awaiting-advance state, and only the Alert raised by
// promptAdvance (or the pill that re-opens it) performs the transition. That
// parked state persists like any other, so backgrounding, a force-quit or a
// notification tapped hours later all come back to the same unanswered
// question rather than to a phase that moved on unseen.
//
// That Alert is also where a finished phase can be carried on instead of moved
// past: "Keep studying" / "Keep resting" put the session into core's open-ended
// state (no deadline, counting up, ended only by the user), and a finished
// break can take EXTRA_BREAK_MINUTES more on its normal countdown. Extra focus
// time is credited on the way out, through the same creditPartial path a skip
// or a stop uses.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Alert, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  addFreeStudyTime,
  addStudyTime,
  clampPomodoroSettings,
  createIdleSession,
  extendPhase,
  extendPhaseByMinutes,
  isAwaitingAdvance,
  isOvertime,
  isPaused,
  isPhaseComplete,
  markPhaseComplete,
  overtimeSeconds,
  pauseSession,
  pendingWorkCreditSeconds,
  phaseDurationSeconds,
  rehydrateSession,
  remainingSeconds,
  resumeSession,
  skipPhase,
  startSession,
} from '@lectio/core/pomodoro-core';
import { getCourses as getCoursesFromCore } from '@lectio/core/planner-core';
import { storage } from '../storage';
import { saveWithConflict } from '../sync/saveWithConflict';
import { prefs } from '../lib/prefs';
import type { PomodoroSession, PomodoroSettings, Semester } from '../../types/lectio-core';

interface PomodoroContextValue {
  session: PomodoroSession;
  settings: PomodoroSettings;
  /** Seconds left in the current phase; recomputed on every tick. */
  remaining: number;
  /**
   * Seconds *into* an open-ended stretch ("Extra focus" / "Extra break"), which
   * counts up instead of down. 0 unless `overtime` is true.
   */
  elapsed: number;
  running: boolean;
  paused: boolean;
  /** The phase finished and is waiting for the user to confirm moving on. */
  awaiting: boolean;
  /** The phase was carried on past its deadline and has no clock counting down. */
  overtime: boolean;
  /** Re-ask "what's next?" for a session that is awaiting advance. */
  promptAdvance: () => void;
  start: (opts: {
    settings: PomodoroSettings;
    courseId: string | null;
    semesterId: string | null;
  }) => Promise<void>;
  togglePause: () => void;
  skip: () => void;
  stop: () => void;
  /** Re-point a live session at another course (null = free study). */
  switchCourse: (courseId: string | null, semesterId: string | null) => void;
}

/** How many minutes the "+N minutes" answer adds to a finished break. */
export const EXTRA_BREAK_MINUTES = 5;

const PomodoroContext = createContext<PomodoroContextValue | null>(null);

export function usePomodoro(): PomodoroContextValue {
  const ctx = useContext(PomodoroContext);
  if (!ctx) throw new Error('usePomodoro must be used inside <PomodoroProvider>');
  return ctx;
}

export function PomodoroProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PomodoroSettings>(() => clampPomodoroSettings(null));
  const [session, setSession] = useState<PomodoroSession>(() => createIdleSession());
  const [remaining, setRemaining] = useState(0);
  // Counts up while a phase runs open-ended; 0 the rest of the time.
  const [elapsed, setElapsed] = useState(0);

  // The interval callback reads these through refs so it never needs to be
  // torn down and rebuilt on every state change.
  const sessionRef = useRef(session);
  const settingsRef = useRef(settings);
  sessionRef.current = session;
  settingsRef.current = settings;

  // At most one phase-completion notification is ever outstanding — this is
  // its id, so every transition can cancel the previous one before scheduling
  // (or not scheduling) the next.
  const notificationIdRef = useRef<string | null>(null);

  // True while the "what's next?" Alert is on screen, so the 1s refresh and a
  // foreground event can't stack a second copy of it on top of the first.
  const promptOpenRef = useRef(false);

  // Keep at most one scheduled notification in sync with the session: cancel
  // whatever was there, then — only for a running (not idle, not paused)
  // session — schedule one for its deadline. This is what makes the alert
  // arrive even if the app is fully backgrounded or the JS timer never runs;
  // the OS delivers it regardless. Permission is requested lazily here, on
  // first use, rather than at app launch, so the app doesn't prompt before
  // the person has touched the timer feature at all. A denial is not an
  // error: the in-app Alert (already in completePhase) still covers the
  // foreground case, so this silently no-ops rather than throwing.
  // Permission is asked for lazily, on first use, rather than at app launch, so
  // the app doesn't prompt before the person has touched the timer at all. A
  // denial is not an error — the in-app Alert still covers the foreground case.
  const ensureNotificationPermission = useCallback(async () => {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status: requested } = await Notifications.requestPermissionsAsync();
    return requested === 'granted';
  }, []);

  // Fire a notification right now. This is the mobile stand-in for the desktop
  // build's synthesized chime: there is no audio API in this package, but the
  // foreground handler (see app/_layout.tsx) plays the notification sound while
  // suppressing the banner, so an immediate notification *is* the sound cue.
  // Used for the one event that has no deadline to schedule against — the whole
  // cycle finishing.
  const notifyNow = useCallback(
    async (body: string) => {
      try {
        if (!(await ensureNotificationPermission())) return;
        await Notifications.scheduleNotificationAsync({
          content: { title: 'Lectio', body, sound: true },
          trigger: null,
        });
      } catch (err) {
        console.warn('pomodoro: could not post notification', err);
      }
    },
    [ensureNotificationPermission]
  );

  const syncScheduledNotification = useCallback(async (next: PomodoroSession) => {
    if (notificationIdRef.current) {
      await Notifications.cancelScheduledNotificationAsync(notificationIdRef.current).catch(
        () => {}
      );
      notificationIdRef.current = null;
    }
    // Nothing to schedule for a phase that is over (its deadline is already in
    // the past), one carried on open-ended (no deadline at all), or one that is
    // paused / idle.
    if (next.phase === 'idle' || next.pausedAt != null) return;
    if (isAwaitingAdvance(next) || isOvertime(next)) return;

    if (!(await ensureNotificationPermission())) return;

    const body =
      next.phase === 'work'
        ? 'Focus block complete — take a break, or keep studying.'
        : next.phase === 'shortBreak'
          ? 'Break over — back to it, or rest a little longer.'
          : 'Long break over — wrap up, or rest a little longer.';

    try {
      notificationIdRef.current = await Notifications.scheduleNotificationAsync({
        content: { title: 'Lectio', body, sound: true },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(next.endsAt),
        },
      });
    } catch (err) {
      console.warn('pomodoro: could not schedule notification', err);
    }
  }, [ensureNotificationPermission]);

  const applySession = useCallback(
    (next: PomodoroSession) => {
      sessionRef.current = next;
      setSession(next);
      setRemaining(remainingSeconds(next));
      setElapsed(overtimeSeconds(next));
      void prefs.setPomodoroSession(JSON.stringify(next));
      void syncScheduledNotification(next);
    },
    [syncScheduledNotification]
  );

  // Credit studied seconds to the session's course, or — with no course — to
  // the semester's own Free study category. Re-reads the semester from storage
  // rather than trusting a screen's copy: the provider outlives every screen,
  // so it may hold no semester at all.
  const creditStudyTime = useCallback(async (s: PomodoroSession, seconds: number) => {
    if (!s.semesterId || seconds <= 0) return;
    try {
      const semester: Semester | null = await storage.get(s.semesterId);
      if (!semester) return;
      const next: Semester = JSON.parse(JSON.stringify(semester));
      if (s.courseId) {
        const course = getCoursesFromCore(next).find((c) => c.id === s.courseId);
        if (!course) return;
        addStudyTime(course, seconds, { source: 'pomodoro' });
      } else {
        addFreeStudyTime(next, seconds, { source: 'pomodoro' });
      }
      await saveWithConflict(s.semesterId, next);
    } catch (err) {
      console.warn('pomodoro: could not credit study time', err);
    }
  }, []);

  // Ask what happens next. This Alert *is* the gate: nothing has advanced when
  // it appears, and only its buttons move the session on. Backgrounded, it is
  // skipped entirely — the scheduled OS notification is the heads-up there, and
  // the session stays parked until the user comes back and answers (on
  // foreground, or by tapping the pill).
  const promptAdvance = useCallback(
    (s: PomodoroSession) => {
      if (!isAwaitingAdvance(s)) return;
      if (AppState.currentState !== 'active' || promptOpenRef.current) return;
      promptOpenRef.current = true;

      const set = settingsRef.current;
      const long = (s.completedPomodoros + 1) % set.pomodorosUntilLongBreak === 0;
      const copy =
        s.phase === 'work'
          ? {
              title: 'Focus block done',
              body: `That block is logged. Take a ${
                long ? set.longBreakMinutes : set.shortBreakMinutes
              }-minute break, or keep studying — the extra time counts too.`,
              confirm: long ? 'Start long break' : 'Start break',
            }
          : s.phase === 'shortBreak'
            ? {
                title: 'Break over',
                body:
                  `Ready for another ${set.workMinutes}-minute focus block? You can also take ` +
                  `${EXTRA_BREAK_MINUTES} more minutes, or rest until you say so.`,
                confirm: 'Start focus block',
              }
            : {
                // A long break ends the cycle: there is no next phase to move
                // on to, so finishing replaces both "advance" and "stop".
                title: 'Long break over',
                body:
                  `That is ${set.pomodorosUntilLongBreak} focus blocks and a long break — a full ` +
                  'cycle. Wrap up, or stay on the break a while longer.',
                confirm: 'Finish session',
              };

      // Every button re-reads the live session: the pill's stop control may
      // have ended it while this Alert sat on screen.
      const guarded = (fn: (current: PomodoroSession) => void) => () => {
        promptOpenRef.current = false;
        const current = sessionRef.current;
        if (isAwaitingAdvance(current)) fn(current);
      };
      const advance = guarded((current) => {
        const next = skipPhase(current, settingsRef.current);
        // Leaving a finished long break is the end of the whole cycle, not just
        // of a phase — its own cue, distinct from the per-phase ones.
        if (current.phase === 'longBreak' && next.phase === 'idle') {
          void notifyNow('That is a full pomodoro cycle — nicely done.');
        }
        applySession(next);
      });
      // No partial credit on any of these: a finished focus block was already
      // credited in full when it completed, and a break credits nothing.
      const end = guarded(() => applySession(createIdleSession()));
      const keepGoing = guarded((current) => applySession(extendPhase(current)));
      const fiveMore = guarded((current) =>
        applySession(extendPhaseByMinutes(current, EXTRA_BREAK_MINUTES))
      );

      // A finished focus block can be carried on; a finished break can be
      // stretched two ways. Ordered so the phase's natural next step is last,
      // which is where iOS puts the emphasised button.
      const buttons =
        s.phase === 'work'
          ? [
              { text: 'Stop timer', style: 'cancel' as const, onPress: end },
              { text: 'Keep studying', onPress: keepGoing },
              { text: copy.confirm, onPress: advance },
            ]
          : [
              ...(s.phase === 'longBreak'
                ? []
                : [{ text: 'Stop timer', style: 'cancel' as const, onPress: end }]),
              { text: `+${EXTRA_BREAK_MINUTES} minutes`, onPress: fiveMore },
              { text: 'Keep resting', onPress: keepGoing },
              { text: copy.confirm, onPress: advance },
            ];

      Alert.alert(
        copy.title,
        copy.body,
        buttons,
        // Android lets an Alert be dismissed by tapping outside; without this
        // the flag would stay set and the question could never be re-asked.
        { onDismiss: () => (promptOpenRef.current = false) }
      );
    },
    [applySession, notifyNow]
  );

  // A finished phase credits its time and parks — it never advances by itself.
  const completePhase = useCallback(
    (s: PomodoroSession) => {
      if (s.phase === 'work') {
        void creditStudyTime(s, phaseDurationSeconds('work', settingsRef.current));
      }
      const parked = markPhaseComplete(s);
      applySession(parked);
      promptAdvance(parked);
    },
    [applySession, creditStudyTime, promptAdvance]
  );

  // Recompute now: park a phase whose deadline passed, re-ask if one is already
  // parked (the completion may have happened while backgrounded), else repaint.
  const refresh = useCallback(() => {
    const s = sessionRef.current;
    if (s.phase === 'idle') return;
    if (isAwaitingAdvance(s)) promptAdvance(s);
    else if (isPhaseComplete(s)) completePhase(s);
    else if (isOvertime(s)) setElapsed(overtimeSeconds(s));
    else setRemaining(remainingSeconds(s));
  }, [completePhase, promptAdvance]);

  // Restore persisted settings + session on mount.
  useEffect(() => {
    let active = true;
    (async () => {
      // `notificationIdRef` is process-local and starts back at null on every
      // launch, so after a force-quit or crash mid-session it has no way to
      // know the id of whatever the *previous* process scheduled — the OS
      // keeps a scheduled notification alive independent of this app's JS
      // running at all. A blanket cancel guarantees a clean slate before
      // anything below reasons about what should be scheduled; nothing else
      // in the app schedules notifications, so this can't collide with an
      // unrelated feature.
      await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});

      const [rawSettings, rawSession] = await Promise.all([
        prefs.getPomodoroSettings(),
        prefs.getPomodoroSession(),
      ]);
      if (!active) return;
      let parsedSettings: unknown = null;
      let parsedSession: unknown = null;
      try {
        parsedSettings = rawSettings ? JSON.parse(rawSettings) : null;
      } catch {
        parsedSettings = null;
      }
      try {
        parsedSession = rawSession ? JSON.parse(rawSession) : null;
      } catch {
        parsedSession = null;
      }
      const nextSettings = clampPomodoroSettings(parsedSettings as Partial<PomodoroSettings>);
      settingsRef.current = nextSettings;
      setSettings(nextSettings);

      // rehydrateSession collapses anything stale or malformed to idle, but
      // returns an expired *work* phase intact so its time is still credited.
      const restored = rehydrateSession(parsedSession);
      sessionRef.current = restored;
      setSession(restored);
      setRemaining(remainingSeconds(restored));
      setElapsed(overtimeSeconds(restored));
      if (restored.phase !== 'idle' && isAwaitingAdvance(restored)) {
        // Parked before the app was closed — the question is still unanswered,
        // and there is nothing to schedule for a deadline already past.
        promptAdvance(restored);
      } else if (restored.phase !== 'idle' && isPhaseComplete(restored)) {
        completePhase(restored);
      } else if (restored.phase !== 'idle') {
        // Still running (or paused): re-establish the notification — or the
        // deliberate lack of one, if paused — now that any orphaned one from
        // a previous process has been cleared above.
        void syncScheduledNotification(restored);
      }
    })();
    return () => {
      active = false;
    };
  }, [completePhase, promptAdvance, syncScheduledNotification]);

  // 1s repaint while a session is running. Nothing decrements here. A parked
  // session has no clock left to repaint, so it is left alone.
  useEffect(() => {
    if (session.phase === 'idle' || isPaused(session) || isAwaitingAdvance(session)) return;
    const id = setInterval(refresh, 1000);
    return () => clearInterval(id);
  }, [
    session.phase,
    session.pausedAt,
    session.endsAt,
    session.awaitingAdvance,
    session.overtimeStartedAt,
    refresh,
  ]);

  // Foreground recompute: the interval may have been throttled or stopped
  // entirely while backgrounded, so re-derive from the deadline on return.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const start = useCallback(
    async (opts: {
      settings: PomodoroSettings;
      courseId: string | null;
      semesterId: string | null;
    }) => {
      const clamped = clampPomodoroSettings(opts.settings);
      settingsRef.current = clamped;
      setSettings(clamped);
      await prefs.setPomodoroSettings(JSON.stringify(clamped));
      // The semester rides along either way: free study is banked on it, as its
      // own category.
      applySession(
        startSession(clamped, { courseId: opts.courseId, semesterId: opts.semesterId })
      );
    },
    [applySession]
  );

  const togglePause = useCallback(() => {
    const s = sessionRef.current;
    if (s.phase === 'idle') return;
    applySession(isPaused(s) ? resumeSession(s) : pauseSession(s));
  }, [applySession]);

  // Whatever the focus phase still owes: the part-worked block when skipping or
  // stopping mid-phase, the extra minutes of an open-ended stretch, nothing at
  // all for a block already banked in full when it finished. Ignored under 30s
  // so a mis-tap does not litter the session log.
  const creditPartial = useCallback(
    (s: PomodoroSession) => {
      const seconds = pendingWorkCreditSeconds(s, settingsRef.current);
      if (seconds >= 30) void creditStudyTime(s, seconds);
    },
    [creditStudyTime]
  );

  // Move on: the "Skip" long-press mid-phase, and the only way out of an
  // open-ended stretch.
  const skip = useCallback(() => {
    const s = sessionRef.current;
    if (s.phase === 'idle') return;
    creditPartial(s);
    const next = skipPhase(s, settingsRef.current);
    if (s.phase === 'longBreak' && next.phase === 'idle') {
      void notifyNow('That is a full pomodoro cycle — nicely done.');
    }
    applySession(next);
  }, [applySession, creditPartial, notifyNow]);

  const stop = useCallback(() => {
    const s = sessionRef.current;
    if (s.phase === 'idle') return;
    creditPartial(s);
    applySession(createIdleSession());
  }, [applySession, creditPartial]);

  // Change which course the *running* session credits, without stopping it.
  // Mid focus block the minutes already worked are banked to the course that
  // earned them — the same rule stop and skip use — and a fresh block starts
  // for the new course, because a completed block always credits its full
  // length and the banked part must not be counted inside it. On a break, or on
  // a block already credited and waiting to be advanced, nothing is accruing,
  // so this is only a change of who gets the next block.
  const switchCourse = useCallback(
    (courseId: string | null, semesterId: string | null) => {
      const s = sessionRef.current;
      if (s.phase === 'idle') return;
      const nextCourseId = courseId || null;
      if ((s.courseId || null) === nextCourseId) return;
      // The semester rides along either way: free study is banked on it too.
      const nextSemesterId = semesterId;

      if (s.phase !== 'work' || isAwaitingAdvance(s)) {
        applySession({ ...s, courseId: nextCourseId, semesterId: nextSemesterId });
        return;
      }
      creditPartial(s);
      const fresh = startSession(settingsRef.current, {
        courseId: nextCourseId,
        semesterId: nextSemesterId,
      });
      applySession({
        ...fresh,
        completedPomodoros: s.completedPomodoros,
        // A paused session stays paused, with the new block's full time on it.
        pausedAt: s.pausedAt != null ? Date.now() : null,
      });
    },
    [applySession, creditPartial]
  );

  // The pill's tap target while a phase is parked: re-open the question.
  const promptAdvanceNow = useCallback(() => {
    promptAdvance(sessionRef.current);
  }, [promptAdvance]);

  return (
    <PomodoroContext.Provider
      value={{
        session,
        settings,
        remaining,
        elapsed,
        running: session.phase !== 'idle' && !isPaused(session) && !isAwaitingAdvance(session),
        paused: isPaused(session),
        awaiting: isAwaitingAdvance(session),
        overtime: isOvertime(session),
        promptAdvance: promptAdvanceNow,
        start,
        togglePause,
        skip,
        stop,
        switchCourse,
      }}
    >
      {children}
    </PomodoroContext.Provider>
  );
}
