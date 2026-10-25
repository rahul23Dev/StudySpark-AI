import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import type { StudyRepository } from './repository';

type DatabaseState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown; retry: () => void }
  | { status: 'ready'; repository: StudyRepository };

const DatabaseContext = createContext<DatabaseState | null>(null);

export type DatabaseProviderProps = {
  children: ReactNode;
  /** How to open the repository; tests pass an in-memory one. */
  open: () => Promise<StudyRepository>;
};

export function DatabaseProvider({ children, open }: DatabaseProviderProps) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<DatabaseState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    open()
      .then((repository) => {
        if (!cancelled) setState({ status: 'ready', repository });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            error,
            retry: () => {
              setState({ status: 'loading' });
              setAttempt((n) => n + 1);
            },
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, attempt]);

  return <DatabaseContext.Provider value={state}>{children}</DatabaseContext.Provider>;
}

export function useDatabase(): DatabaseState {
  const state = useContext(DatabaseContext);
  if (!state) throw new Error('useDatabase must be used inside <DatabaseProvider>');
  return state;
}

/** The repository, for screens rendered only once the database is ready. */
export function useRepository(): StudyRepository {
  const state = useDatabase();
  if (state.status !== 'ready') throw new Error('The database is not ready yet');
  return state.repository;
}
