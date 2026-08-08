// Owns the conflict-dialog state. On mount it registers a setter with the
// plain-module `saveWithConflict` helper (which lives outside React) so that a
// ConflictError raised by any save anywhere in the app can open the dialog.
// Renders only its children; the dialog UI is <ConflictDialog>, which reads
// this context.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { registerConflictOpener, type ConflictChoice, type ConflictInfo } from './saveWithConflict';

interface ConflictContextValue {
  conflict: ConflictInfo | null;
  close: (choice: ConflictChoice) => void;
}

const ConflictContext = createContext<ConflictContextValue>({
  conflict: null,
  close: () => {},
});

export function useConflict(): ConflictContextValue {
  return useContext(ConflictContext);
}

export function ConflictProvider({ children }: { children: ReactNode }) {
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);

  useEffect(() => {
    registerConflictOpener((c) => setConflict(c));
    return () => registerConflictOpener(null);
  }, []);

  // Resolve the pending save with the user's choice and dismiss the dialog.
  const close = useCallback(
    (choice: ConflictChoice) => {
      if (conflict) conflict.resolve(choice);
      setConflict(null);
    },
    [conflict]
  );

  return (
    <ConflictContext.Provider value={{ conflict, close }}>{children}</ConflictContext.Provider>
  );
}
