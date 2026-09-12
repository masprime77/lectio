import { describe, it, expect } from 'vitest';
import pomodoro from '../../src/pomodoro-core.js';

const {
  createIdleStopwatch,
  startStopwatch,
  pauseStopwatch,
  resumeStopwatch,
  resetStopwatch,
  stopwatchSeconds,
  isStopwatchRunning,
  isStopwatchPaused,
  isStopwatchIdle,
  rehydrateStopwatch,
  MAX_STOPWATCH_SECONDS,
} = pomodoro;

const T0 = new Date(2025, 3, 9, 14, 0, 0).getTime();
const at = (seconds) => T0 + seconds * 1000;

describe('stopwatch states', () => {
  it('starts idle', () => {
    const sw = createIdleStopwatch();
    expect(isStopwatchIdle(sw)).toBe(true);
    expect(isStopwatchRunning(sw)).toBe(false);
    expect(isStopwatchPaused(sw)).toBe(false);
    expect(stopwatchSeconds(sw, T0)).toBe(0);
  });

  it('runs once started, and records the local date it began on', () => {
    const sw = startStopwatch({ semesterId: 'ss2025' }, T0);
    expect(isStopwatchRunning(sw)).toBe(true);
    expect(isStopwatchIdle(sw)).toBe(false);
    expect(sw.semesterId).toBe('ss2025');
    expect(sw.startedDate).toBe('2025-04-09');
  });

  it('counts up from the start', () => {
    const sw = startStopwatch({}, T0);
    expect(stopwatchSeconds(sw, T0)).toBe(0);
    expect(stopwatchSeconds(sw, at(59))).toBe(59);
    expect(stopwatchSeconds(sw, at(3661))).toBe(3661);
  });

  it('freezes while paused and is paused, not idle, with time on the clock', () => {
    const paused = pauseStopwatch(startStopwatch({}, T0), at(90));
    expect(isStopwatchPaused(paused)).toBe(true);
    expect(isStopwatchRunning(paused)).toBe(false);
    expect(isStopwatchIdle(paused)).toBe(false);
    expect(stopwatchSeconds(paused, at(90))).toBe(90);
    expect(stopwatchSeconds(paused, at(9000))).toBe(90);
  });

  it('does not credit the pause when resumed', () => {
    const paused = pauseStopwatch(startStopwatch({}, T0), at(90));
    const resumed = resumeStopwatch(paused, at(1000));
    expect(isStopwatchRunning(resumed)).toBe(true);
    expect(stopwatchSeconds(resumed, at(1000))).toBe(90);
    expect(stopwatchSeconds(resumed, at(1030))).toBe(120);
  });

  it('keeps the original start date across pauses', () => {
    const sw = resumeStopwatch(pauseStopwatch(startStopwatch({}, T0), at(90)), at(1000));
    expect(sw.startedDate).toBe('2025-04-09');
  });

  it('resets to idle', () => {
    expect(isStopwatchIdle(resetStopwatch())).toBe(true);
  });

  it('ignores pause on a paused stopwatch and resume on a running one', () => {
    const paused = pauseStopwatch(startStopwatch({}, T0), at(90));
    expect(pauseStopwatch(paused, at(200))).toBe(paused);
    const running = startStopwatch({}, T0);
    expect(resumeStopwatch(running, at(200))).toBe(running);
    expect(resumeStopwatch(createIdleStopwatch(), at(200))).toEqual(createIdleStopwatch());
  });

  it('caps a stopwatch left running, so a forgotten one cannot bank a day', () => {
    const sw = startStopwatch({}, T0);
    expect(stopwatchSeconds(sw, at(MAX_STOPWATCH_SECONDS + 5000))).toBe(MAX_STOPWATCH_SECONDS);
  });
});

describe('rehydrateStopwatch', () => {
  it('collapses anything malformed to idle', () => {
    expect(rehydrateStopwatch(null)).toEqual(createIdleStopwatch());
    expect(rehydrateStopwatch('nope')).toEqual(createIdleStopwatch());
    expect(rehydrateStopwatch({})).toEqual(createIdleStopwatch());
    expect(rehydrateStopwatch({ runningSince: 'x', bankedSeconds: 'y' })).toEqual(
      createIdleStopwatch()
    );
  });

  it('restores a running stopwatch, still counting', () => {
    const sw = rehydrateStopwatch(startStopwatch({ semesterId: 'ss2025' }, T0));
    expect(isStopwatchRunning(sw)).toBe(true);
    expect(stopwatchSeconds(sw, at(120))).toBe(120);
    expect(sw.semesterId).toBe('ss2025');
  });

  it('restores a paused stopwatch with its banked time', () => {
    const sw = rehydrateStopwatch(pauseStopwatch(startStopwatch({}, T0), at(150)));
    expect(isStopwatchPaused(sw)).toBe(true);
    expect(stopwatchSeconds(sw, at(99999))).toBe(150);
  });

  it('drops an unusable start date rather than carrying it', () => {
    const sw = rehydrateStopwatch({ runningSince: T0, bankedSeconds: 0, startedDate: 'x' });
    expect(sw.startedDate).toBeNull();
  });
});
