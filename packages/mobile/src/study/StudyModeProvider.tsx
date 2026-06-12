// Study Mode: when on, progress numbers count only items tagged Studied.
// A pure calculation overlay — it never changes tags or the semester JSON.
// Device-local UI state persisted via prefs, mirroring the desktop's
// restoreStudyMode + state.studyMode.
import { createContext, useContext, useEffect, useState } from 'react';
import { prefs } from '../lib/prefs';

interface StudyModeContextValue {
  studyMode: boolean;
  setStudyMode(on: boolean): void;
  toggle(): void;
}

const StudyModeContext = createContext<StudyModeContextValue | null>(null);

export function StudyModeProvider({ children }: { children: React.ReactNode }) {
  const [studyMode, setStudyModeState] = useState(false);

  useEffect(() => {
    prefs.getStudyMode().then(setStudyModeState);
  }, []);

  function setStudyMode(on: boolean) {
    setStudyModeState(on);
    prefs.setStudyMode(on);
  }

  function toggle() {
    setStudyModeState((prev) => {
      const next = !prev;
      prefs.setStudyMode(next);
      return next;
    });
  }

  return (
    <StudyModeContext.Provider value={{ studyMode, setStudyMode, toggle }}>
      {children}
    </StudyModeContext.Provider>
  );
}

export function useStudyMode(): StudyModeContextValue {
  const ctx = useContext(StudyModeContext);
  if (!ctx) throw new Error('useStudyMode must be used inside StudyModeProvider');
  return ctx;
}
