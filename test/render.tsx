import AsyncStorage from '@react-native-async-storage/async-storage';
import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { Text } from 'react-native';

import { DatabaseProvider, useDatabase } from '@/data/database-context';
import type { StudyRepository } from '@/data/repository';
import { SETTINGS_STORAGE_KEY, SettingsProvider, type Settings } from '@/settings/settings-context';

/** Renders inside SettingsProvider with the given stored settings already in AsyncStorage. */
export async function renderWithSettings(ui: ReactElement, stored?: Partial<Settings>) {
  await AsyncStorage.clear();
  if (stored) {
    await AsyncStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ displayName: '', hasSeenOnboarding: true, ...stored }),
    );
  }
  return render(<SettingsProvider>{ui}</SettingsProvider>);
}

// Mirrors the app's root DatabaseGate: screens render only once the database is ready.
function ReadyGate({ children }: { children: ReactNode }) {
  return useDatabase().status === 'ready' ? children : <Text>database-loading</Text>;
}

/**
 * Renders a screen with settings and a ready database. Pass a repository from
 * openTestRepository() (real in-memory SQLite) to share data with the test.
 */
export async function renderScreen(ui: ReactElement, repository: StudyRepository, stored: Partial<Settings> = {}) {
  const open = () => Promise.resolve(repository);
  return renderWithSettings(
    <DatabaseProvider open={open}>
      <ReadyGate>{ui}</ReadyGate>
    </DatabaseProvider>,
    stored,
  );
}

/** Whether a rendered radio/checkbox is checked (aria-checked or accessibilityState). */
export function isChecked(element: { props: Record<string, unknown> }): boolean | undefined {
  const state = element.props.accessibilityState as { checked?: boolean } | undefined;
  return (element.props['aria-checked'] as boolean | undefined) ?? state?.checked;
}

/** Whether a rendered host element is marked selected (aria-selected or accessibilityState). */
export function isSelected(element: { props: Record<string, unknown> }): boolean | undefined {
  const state = element.props.accessibilityState as { selected?: boolean } | undefined;
  return (element.props['aria-selected'] as boolean | undefined) ?? state?.selected;
}
