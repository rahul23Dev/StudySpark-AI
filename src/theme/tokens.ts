import type { TextStyle, ViewStyle } from 'react-native';

/**
 * StudySpark AI design tokens. Components read from here instead of hard-coding
 * values, so the look can evolve in one place.
 */
export const colors = {
  background: '#FFF8EE', // warm cream
  surface: '#FFFFFF',
  surfaceMuted: '#FBEFDD',
  border: '#EADFCB',

  text: '#1B2A4A', // deep navy
  textMuted: '#4A5875',
  textOnPrimary: '#FFFFFF',

  primary: '#0E7C7B', // teal
  primaryPressed: '#0A6463',
  primarySoft: '#EAF7F5',

  accent: '#FF7A59', // coral – decorative highlights only, not text on cream
  accentSoft: '#FFE3D8',
  accentText: '#B5432A', // coral tuned for readable text on light surfaces
  highlight: '#FFC94D', // sunny yellow

  success: '#2E7D5B',
  danger: '#B3261E',
} as const;

export type ColorName = keyof typeof colors;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: '800', letterSpacing: -0.5 },
  title: { fontSize: 24, lineHeight: 32, fontWeight: '700' },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  label: { fontSize: 16, lineHeight: 20, fontWeight: '700' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '600', letterSpacing: 0.3 },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

export const shadows = {
  card: { boxShadow: '0px 6px 16px rgba(27, 42, 74, 0.08)' },
  raised: { boxShadow: '0px 10px 24px rgba(27, 42, 74, 0.14)' },
} as const satisfies Record<string, ViewStyle>;

/** Minimum size for anything tappable (Material 48dp, Apple 44pt). */
export const MIN_TOUCH_TARGET = 48;

/** Widest the content column grows on tablets and web. */
export const MAX_CONTENT_WIDTH = 560;
