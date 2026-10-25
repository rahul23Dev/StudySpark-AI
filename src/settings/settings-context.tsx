import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export const SETTINGS_STORAGE_KEY = 'studyspark.settings.v1';
export const MAX_DISPLAY_NAME_LENGTH = 40;

export type Settings = {
  displayName: string;
  hasSeenOnboarding: boolean;
};

export const DEFAULT_SETTINGS: Settings = { displayName: '', hasSeenOnboarding: false };

export type SettingsStatus = 'loading' | 'ready' | 'error';

type SettingsContextValue = {
  status: SettingsStatus;
  settings: Settings;
  /** Re-reads settings from storage, e.g. after a load error. */
  reload: () => void;
  setDisplayName: (name: string) => Promise<void>;
  completeOnboarding: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

/** Accepts only well-formed stored values; anything else falls back to defaults. */
export function parseSettings(raw: string | null): Settings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return DEFAULT_SETTINGS;
    const { displayName, hasSeenOnboarding } = value as Partial<Record<keyof Settings, unknown>>;
    return {
      displayName: typeof displayName === 'string' ? displayName.slice(0, MAX_DISPLAY_NAME_LENGTH) : '',
      hasSeenOnboarding: hasSeenOnboarding === true,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SettingsStatus>('loading');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(SETTINGS_STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;
        setSettings(parseSettings(raw));
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // Saves first, then updates state, so the UI never shows a value that was not stored.
  const save = useCallback(
    async (next: Settings) => {
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
      setSettings(next);
    },
    [],
  );

  const value = useMemo<SettingsContextValue>(
    () => ({
      status,
      settings,
      reload: () => {
        setStatus('loading');
        setAttempt((n) => n + 1);
      },
      setDisplayName: (name) =>
        save({ ...settings, displayName: name.trim().slice(0, MAX_DISPLAY_NAME_LENGTH) }),
      completeOnboarding: () => save({ ...settings, hasSeenOnboarding: true }),
    }),
    [status, settings, save],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside <SettingsProvider>');
  return value;
}
