import { useSettings } from './settings-context';

export const DEFAULT_DISPLAY_NAME = 'Learner';

/** The name to greet the user with; falls back when none is saved. */
export function useDisplayName(): string {
  const { settings } = useSettings();
  return settings.displayName || DEFAULT_DISPLAY_NAME;
}

/** Up to two initials, e.g. "Alex Morgan" -> "AM". */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '');
  return initials.join('') || DEFAULT_DISPLAY_NAME[0];
}
