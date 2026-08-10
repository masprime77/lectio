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
  addStudyTime,
  clampPomodoroSettings,
  confirmAdvance,
  createIdleSession,
  elapsedWorkSeconds,
  isAwaitingAdvance,
  isPaused,
  isPhaseComplete,
  markPhaseComplete,
  pauseSession,
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
  running: boolean;
  paused: boolean;
  /** The phase finished and is waiting for the user to confirm moving on. */
  awaiting: boolean;
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
  const syncScheduledNotification = useCallback(async (next: PomodoroSession) => {
    if (notificationIdRef.current) {
      await Notifications.cancelScheduledNotificationAsync(notificationIdRef.current).catch(
        () => {}
      );
      notificationIdRef.current = null;
    }
    // Nothing to schedule for a phase that is over (its deadline is already in
    // the past) or one that is paused / idle.
    if (next.phase === 'idle' || next.pausedAt != null || isAwaitingAdvance(next)) return;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let granted = existing === 'granted';
    if (!granted) {
      const { status: requested } = await Notifications.requestPermissionsAsync();
      granted = requested === 'granted';
    }
    if (!granted) return;

    const body =
      next.phase === 'work'
        ? 'Focus block complete — take a break.'
        : next.phase === 'shortBreak'
          ? 'Break over — back to it.'
          : 'Long break over — back to it.';

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
  }, []);

  const applySession = useCallback(
    (next: PomodoroSession) => {
      sessionRef.current = next;
      setSession(next);
      setRemaining(remainingSeconds(next));
      void prefs.setPomodoroSession(JSON.stringify(next));
      void syncScheduledNotification(next);
    },
    [syncScheduledNotification]
  );

  // Credit studied seconds to the session's course. No-ops for free study.
  // Re-reads the semester from storage rather than trusting a screen's copy —
  // the provider outlives every screen, so it may hold no semester at all.
  const creditStudyTime = useCallback(async (s: PomodoroSession, seconds: number) => {
    if (!s.courseId || !s.semesterId || seconds <= 0) return;
    try {
      const semester: Semester | null = await storage.get(s.semesterId);
      if (!semester) return;
      const next: Semester = JSON.parse(JSON.stringify(semester));
      const course = getCoursesFromCore(next).find((c) => c.id === s.courseId);
      if (!course) return;
      addStudyTime(course, seconds, { source: 'pomodoro' });
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
              }-minute break?`,
              confirm: long ? 'Start long break' : 'Start break',
              canStop: true,
            }
          : s.phase === 'shortBreak'
            ? {
                title: 'Break over',
                body: `Ready for another ${set.workMinutes}-minute focus block?`,
                confirm: 'Start focus block',
                canStop: true,
              }
            : {
                // A long break ends the cycle, so confirming and stopping are
                // the same thing — only one button makes sense.
                title: 'Long break over',
                body: `That is ${set.pomodorosUntilLongBreak} focus blocks and a long break — a full cycle.`,
                confirm: 'Finish session',
                canStop: false,
              };

      // Both buttons re-read the live session: the pill's stop control may have
      // ended it while this Alert sat on screen.
      const advance = () => {
        promptOpenRef.current = false;
        const current = sessionRef.current;
        if (!isAwaitingAdvance(current)) return;
        applySession(confirmAdvance(current, settingsRef.current));
      };
      const end = () => {
        promptOpenRef.current = false;
        // No partial credit here: a finished focus block was already credited
        // in full when it completed.
        if (isAwaitingAdvance(sessionRef.current)) applySession(createIdleSession());
      };

      Alert.alert(
        copy.title,
        copy.body,
        copy.canStop
          ? [
              { text: 'Stop timer', style: 'cancel', onPress: end },
              { text: copy.confirm, onPress: advance },
            ]
          : [{ text: copy.confirm, onPress: advance }],
        // Android lets an Alert be dismissed by tapping outside; without this
        // the flag would stay set and the question could never be re-asked.
        { onDismiss: () => (promptOpenRef.current = false) }
      );
    },
    [applySession]
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
  }, [session.phase, session.pausedAt, session.endsAt, session.awaitingAdvance, refresh]);

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
      applySession(
        startSession(clamped, {
          courseId: opts.courseId,
          semesterId: opts.courseId ? opts.semesterId : null,
        })
      );
    },
    [applySession]
  );

  const togglePause = useCallback(() => {
    const s = sessionRef.current;
    if (s.phase === 'idle') return;
    applySession(isPaused(s) ? resumeSession(s) : pauseSession(s));
  }, [applySession]);

  // Skipping or stopping mid-focus still credits what was actually worked,
  // ignored under 30s so a mis-tap does not litter the session log.
  const creditPartial = useCallback(
    (s: PomodoroSession) => {
      // A parked focus block was already credited in full when it finished —
      // crediting elapsed time again here would count it twice.
      if (s.phase !== 'work' || isAwaitingAdvance(s)) return;
      const elapsed = elapsedWorkSeconds(s, settingsRef.current);
      if (elapsed >= 30) void creditStudyTime(s, elapsed);
    },
    [creditStudyTime]
  );

  const skip = useCallback(() => {
    const s = sessionRef.current;
    if (s.phase === 'idle') return;
    creditPartial(s);
    applySession(skipPhase(s, settingsRef.current));
  }, [applySession, creditPartial]);

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
      const nextSemesterId = nextCourseId ? semesterId : null;

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
        running: session.phase !== 'idle' && !isPaused(session) && !isAwaitingAdvance(session),
        paused: isPaused(session),
        awaiting: isAwaitingAdvance(session),
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
