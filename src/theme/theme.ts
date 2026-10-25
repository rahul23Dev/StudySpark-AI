import { colors, radii, shadows, spacing, typography } from './tokens';

export type ThemeName = 'light';

/** The app's light theme. Only light exists for now; dark is planned. */
export const lightTheme = {
  name: 'light' as ThemeName,
  colors,
  spacing,
  radii,
  typography,
  shadows,
  statusBarStyle: 'dark' as const,
};
