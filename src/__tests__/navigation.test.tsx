import { fireEvent, render, screen } from '@testing-library/react-native';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Text } from 'react-native';

import TabsLayout from '@/app/(tabs)/_layout';
import { FloatingTabBar } from '@/components/tab-bar';

import { isSelected, renderWithSettings } from '../../test/render';

jest.mock('expo-router', () => {
  const { Text: MockText } = jest.requireActual('react-native');
  return { Redirect: ({ href }: { href: string }) => <MockText>redirect:{href}</MockText> };
});

jest.mock('expo-router/tabs', () => {
  const { Text: MockText } = jest.requireActual('react-native');
  const Tabs = ({ children }: { children: unknown }) => (
    <>
      <MockText>tabs-navigator</MockText>
      {children}
    </>
  );
  function MockScreen({ name, options }: { name: string; options: { title: string } }) {
    return (
      <MockText>
        screen:{name}:{options.title}
      </MockText>
    );
  }
  Tabs.Screen = MockScreen;
  return { Tabs };
});

describe('Tabs layout', () => {
  it('sends first-time users to onboarding', async () => {
    await renderWithSettings(<TabsLayout />);
    expect(await screen.findByText('redirect:/onboarding')).toBeTruthy();
  });

  it('shows the four main destinations after onboarding', async () => {
    await renderWithSettings(<TabsLayout />, { hasSeenOnboarding: true });
    expect(await screen.findByText('tabs-navigator')).toBeTruthy();
    for (const tab of ['index:Home', 'decks:My Decks', 'progress:Progress', 'profile:Profile']) {
      expect(screen.getByText(`screen:${tab}`)).toBeTruthy();
    }
  });
});

describe('FloatingTabBar', () => {
  const routes = [
    { key: 'home-key', name: 'index' },
    { key: 'decks-key', name: 'decks' },
  ];

  function renderBar(index: number) {
    const emitter = { emit: jest.fn(() => ({ defaultPrevented: false })) };
    const navigateToTab = jest.fn();
    const descriptors = Object.fromEntries(
      routes.map((r, i) => [
        r.key,
        { options: { title: i === 0 ? 'Home' : 'My Decks', tabBarIcon: () => <Text>icon</Text> } },
      ]),
    );
    const props = {
      state: { index, routes },
      descriptors,
      emitter,
      navigateToTab,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    } as unknown as BottomTabBarProps;
    return { render: () => render(<FloatingTabBar {...props} />), emitter, navigateToTab };
  }

  it('marks the current tab selected and switches tabs on press', async () => {
    const bar = renderBar(0);
    await bar.render();
    expect(isSelected(screen.getByRole('tab', { name: 'Home' }))).toBe(true);
    expect(isSelected(screen.getByRole('tab', { name: 'My Decks' }))).toBe(false);

    await fireEvent.press(screen.getByRole('tab', { name: 'My Decks' }));
    expect(bar.navigateToTab).toHaveBeenCalledWith('decks-key');
  });

  it('does not re-navigate to the tab that is already open', async () => {
    const bar = renderBar(0);
    await bar.render();
    await fireEvent.press(screen.getByRole('tab', { name: 'Home' }));
    expect(bar.emitter.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'tabPress' }));
    expect(bar.navigateToTab).not.toHaveBeenCalled();
  });
});
