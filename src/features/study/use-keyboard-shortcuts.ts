import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Keyboard shortcuts for the web build (and hardware keyboards on web). Keys are
 * matched on `event.key`, lower-cased for single characters (" " is Space). Ignored
 * while typing in a field, with modifier keys held, or when Enter/Space would already
 * activate a focused button (so one key press never acts twice).
 */
export function useKeyboardShortcuts(handlers: Record<string, () => void>, enabled = true) {
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled || typeof window === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if ((key === 'Enter' || key === ' ') && target?.closest?.('[role="button"], [role="radio"], button')) return;
      const handler = handlers[key];
      if (handler) {
        event.preventDefault();
        handler();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers, enabled]);
}
