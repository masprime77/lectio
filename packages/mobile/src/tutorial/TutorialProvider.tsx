// Tutorial state: which step is showing and whether the overlay is active.
// Mirrors the desktop renderer's tutorial engine (step index + Back/Next/Skip)
// but as a paged walkthrough rather than a DOM spotlight. Finishing or skipping
// marks the tutorial seen (device-local pref) so first-run shows it only once;
// replaying from Settings does not clear that flag.
import { createContext, useContext, useState } from 'react';
import { prefs } from '../lib/prefs';
import { TUTORIAL_STEPS } from './steps';

interface TutorialContextValue {
  active: boolean;
  index: number;
  total: number;
  start(): void;
  next(): void;
  back(): void;
  skip(): void;
  finish(): void;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const total = TUTORIAL_STEPS.length;

  function start() {
    setIndex(0);
    setActive(true);
  }

  function finish() {
    setActive(false);
    prefs.setTutorialSeen(true);
  }

  function skip() {
    finish();
  }

  function next() {
    setIndex((prev) => {
      if (prev >= total - 1) {
        finish();
        return prev;
      }
      return prev + 1;
    });
  }

  function back() {
    setIndex((prev) => (prev > 0 ? prev - 1 : 0));
  }

  return (
    <TutorialContext.Provider
      value={{ active, index, total, start, next, back, skip, finish }}
    >
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error('useTutorial must be used inside TutorialProvider');
  return ctx;
}
