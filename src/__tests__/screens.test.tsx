import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import HomeScreen from '@/app/(tabs)/index';
import ProfileScreen from '@/app/(tabs)/profile';
import OnboardingScreen from '@/app/onboarding';
import SettingsScreen from '@/app/settings';
import { SETTINGS_STORAGE_KEY } from '@/settings/settings-context';

import { mockRouter, resetMockRouter } from '../../test/expo-router-mock';
import { openTestRepository } from '../../test/node-sqlite';
import { renderScreen, renderWithSettings } from '../../test/render';

jest.mock('expo-router', () => jest.requireActual('../../test/expo-router-mock'));

beforeEach(() => resetMockRouter());

// Testing Library v14 renders and fires events asynchronously.
describe('Home', () => {
  it('greets the saved name and links to decks and profile', async () => {
    const { repo } = await openTestRepository();
    await renderScreen(<HomeScreen />, repo, { displayName: 'Priya Shah' });
    expect(await screen.findByText('Hello, Priya Shah')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Open My Decks' }));
    expect(mockRouter.navigate).toHaveBeenCalledWith('/decks');

    await fireEvent.press(screen.getByRole('button', { name: 'Open your profile' }));
    expect(mockRouter.navigate).toHaveBeenCalledWith('/profile');
  });

  it('shows real deck and card counts', async () => {
    const { repo } = await openTestRepository();
    const deck = await repo.createDeck({ title: 'Biology' });
    await repo.createFlashcard(deck.id, { front: 'Cell', back: 'Unit of life' });
    await renderScreen(<HomeScreen />, repo);
    expect(await screen.findByLabelText('Decks: 1')).toBeTruthy();
    expect(screen.getByLabelText('Flashcards: 1')).toBeTruthy();
    expect(screen.getByText('Keep your decks\ngrowing')).toBeTruthy();
  });

  it('falls back to "Learner" and links each study tool', async () => {
    const { repo } = await openTestRepository();
    await renderScreen(<HomeScreen />, repo);
    expect(await screen.findByText('Hello, Learner')).toBeTruthy();
    expect(screen.queryByText('Coming soon')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /^Study progress/ }));
    expect(mockRouter.navigate).toHaveBeenCalledWith('/progress');
  });
});

describe('Profile', () => {
  it('opens settings and the introduction', async () => {
    await renderWithSettings(<ProfileScreen />, { displayName: 'Sam' });
    expect(await screen.findByText('Sam')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: /^Settings/ }));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings');

    await fireEvent.press(screen.getByRole('button', { name: /^Replay introduction/ }));
    expect(mockRouter.push).toHaveBeenCalledWith('/onboarding');
  });
});

describe('Settings', () => {
  it('saves a trimmed display name', async () => {
    await renderWithSettings(<SettingsScreen />, {});
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save.props.accessibilityState).toMatchObject({ disabled: true });

    await fireEvent.changeText(screen.getByLabelText('Display name'), '  Alex  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Saved')).toBeTruthy();
    expect(JSON.parse((await AsyncStorage.getItem(SETTINGS_STORAGE_KEY)) ?? '{}')).toMatchObject({
      displayName: 'Alex',
    });
  });
});

describe('Onboarding', () => {
  it('remembers completion and enters the app on first launch', async () => {
    await renderWithSettings(<OnboardingScreen />);
    expect(screen.getByText(/Learn Smarter\.\s+Remember Longer\./)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Get started' }));

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/'));
    expect(JSON.parse((await AsyncStorage.getItem(SETTINGS_STORAGE_KEY)) ?? '{}')).toMatchObject({
      hasSeenOnboarding: true,
    });
  });

  it('goes back when replayed from Profile', async () => {
    mockRouter.canGoBack.mockReturnValueOnce(true);
    await renderWithSettings(<OnboardingScreen />, {});
    await fireEvent.press(screen.getByRole('button', { name: 'Get started' }));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});
