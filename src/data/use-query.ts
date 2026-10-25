import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

export type QueryState<T> =
  | { status: 'loading'; data?: T }
  | { status: 'error'; error: unknown; data?: T }
  | { status: 'ready'; data: T };

/**
 * Runs `load` whenever the screen gains focus (so lists are fresh after editing on
 * another screen) and whenever `load` changes. Keeps the previous data while
 * reloading so lists don't flash.
 */
export function useFocusQuery<T>(load: () => Promise<T>): QueryState<T> & { reload: () => void } {
  const [state, setState] = useState<QueryState<T>>({ status: 'loading' });
  const latest = useRef(0);

  const reload = useCallback(() => {
    const request = ++latest.current;
    setState((s) => ({ status: 'loading', data: s.data }));
    load().then(
      (data) => {
        if (request === latest.current) setState({ status: 'ready', data });
      },
      (error: unknown) => {
        if (request === latest.current) setState((s) => ({ status: 'error', error, data: s.data }));
      },
    );
  }, [load]);

  useFocusEffect(reload);

  return { ...state, reload };
}
