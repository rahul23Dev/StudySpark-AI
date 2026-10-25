import { DefaultTheme, type Theme } from 'expo-router';

import { colors } from './tokens';

/** The light theme mapped onto React Navigation's theme shape (headers, backgrounds). */
export const lightNavigationTheme: Theme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primaryText,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
    notification: colors.accent,
  },
};
