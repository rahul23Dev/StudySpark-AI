import { fireEvent, render, screen } from '@testing-library/react-native';

import HomeScreen from '@/app/home';
import WelcomeScreen from '@/app/index';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

beforeEach(() => mockPush.mockClear());

// Testing Library v14 renders and fires events asynchronously.
describe('WelcomeScreen', () => {
  it('shows the brand, tagline and a Get started button', async () => {
    await render(<WelcomeScreen />);
    expect(screen.getByText('StudySpark AI')).toBeTruthy();
    expect(screen.getByText(/Learn Smarter\.\s+Remember Longer\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Get started' })).toBeTruthy();
  });

  it('opens the study space when Get started is pressed', async () => {
    await render(<WelcomeScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Get started' }));
    expect(mockPush).toHaveBeenCalledWith('/home');
  });
});

describe('HomeScreen', () => {
  it('lists every planned study tool as coming soon', async () => {
    await render(<HomeScreen />);
    for (const title of ['Flashcards', 'Quizzes', 'Study progress']) {
      expect(screen.getByText(title)).toBeTruthy();
    }
    expect(screen.getAllByText('Coming soon')).toHaveLength(3);
  });

  it('shows the empty state while there are no study sets', async () => {
    await render(<HomeScreen />);
    expect(screen.getByText('No study sets yet')).toBeTruthy();
  });
});
