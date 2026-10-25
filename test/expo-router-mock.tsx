// Stand-in for expo-router in screen tests: a jest.fn router, settable route params,
// focus effects that run like mount effects, and a no-op <Stack.Screen>.
// Use with: jest.mock('expo-router', () => jest.requireActual('<path>/test/expo-router-mock'));
import { useEffect } from 'react';

export const mockRouter = {
  push: jest.fn(),
  navigate: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  dismissTo: jest.fn(),
  canGoBack: jest.fn(() => false),
};

let params: Record<string, string> = {};
export function setMockParams(next: Record<string, string>) {
  params = next;
}

export function resetMockRouter() {
  Object.values(mockRouter).forEach((fn) => fn.mockReset());
  mockRouter.canGoBack.mockReturnValue(false);
  params = {};
}

export const useRouter = () => mockRouter;
export const useLocalSearchParams = () => params;
export function useFocusEffect(effect: () => void | (() => void)) {
  useEffect(effect, [effect]);
}
export const Stack = { Screen: () => null };
/** Mirrors <Redirect>: replaces the current route once rendered. */
export function Redirect({ href }: { href: string }) {
  useEffect(() => {
    mockRouter.replace(href);
  }, [href]);
  return null;
}
