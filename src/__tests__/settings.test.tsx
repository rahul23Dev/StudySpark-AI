import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { initialsOf } from '@/settings/display-name';
import {
  DEFAULT_SETTINGS,
  parseSettings,
  SETTINGS_STORAGE_KEY,
  SettingsProvider,
  useSettings,
} from '@/settings/settings-context';

describe('parseSettings', () => {
  it('falls back to defaults for missing or malformed data', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('not json')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('42')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(JSON.stringify({ displayName: 7, hasSeenOnboarding: 'yes' }))).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid values and caps the name length', () => {
    const long = 'x'.repeat(60);
    expect(parseSettings(JSON.stringify({ displayName: long, hasSeenOnboarding: true, dailyGoal: 30 }))).toEqual({
      displayName: 'x'.repeat(40),
      hasSeenOnboarding: true,
      dailyGoal: 30,
    });
  });

  it('accepts only the offered daily goals, defaulting to 20 (also for settings saved before goals existed)', () => {
    expect(parseSettings(JSON.stringify({ displayName: 'A', hasSeenOnboarding: true })).dailyGoal).toBe(20);
    expect(parseSettings(JSON.stringify({ dailyGoal: 7 })).dailyGoal).toBe(20);
    expect(parseSettings(JSON.stringify({ dailyGoal: '50' })).dailyGoal).toBe(20);
    expect(parseSettings(JSON.stringify({ dailyGoal: 50 })).dailyGoal).toBe(50);
  });
});

describe('initialsOf', () => {
  it('uses up to two initials', () => {
    expect(initialsOf('Alex Morgan Lee')).toBe('AM');
    expect(initialsOf('sam')).toBe('S');
    expect(initialsOf('   ')).toBe('L');
  });
});

function Probe() {
  const { status, settings, setDisplayName, completeOnboarding } = useSettings();
  return (
    <>
      <Text>status:{status}</Text>
      <Text>name:{settings.displayName}</Text>
      <Text>seen:{String(settings.hasSeenOnboarding)}</Text>
      <Text onPress={() => setDisplayName('  Priya  ')}>rename</Text>
      <Text onPress={() => completeOnboarding()}>finish</Text>
    </>
  );
}

describe('SettingsProvider', () => {
  beforeEach(() => AsyncStorage.clear());

  it('loads, saves trimmed names and remembers onboarding', async () => {
    await render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    );
    expect(await screen.findByText('status:ready')).toBeTruthy();
    expect(screen.getByText('seen:false')).toBeTruthy();

    await act(async () => {
      screen.getByText('rename').props.onPress();
    });
    await act(async () => {
      screen.getByText('finish').props.onPress();
    });

    expect(screen.getByText('name:Priya')).toBeTruthy();
    expect(screen.getByText('seen:true')).toBeTruthy();
    expect(JSON.parse((await AsyncStorage.getItem(SETTINGS_STORAGE_KEY)) ?? '{}')).toEqual({
      displayName: 'Priya',
      hasSeenOnboarding: true,
      dailyGoal: 20,
    });
  });

  it('reports an error when storage cannot be read', async () => {
    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('disk'));
    await render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    );
    expect(await screen.findByText('status:error')).toBeTruthy();
  });
});
