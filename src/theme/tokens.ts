import type { TextStyle, ViewStyle } from 'react-native';

/**
 * StudySpark AI design tokens. Components read from here instead of hard-coding
 * values, so the look can evolve in one place. Brand values come from the Phase 1 brief.
 */
export const palette = {
  cream: '#FFF9F0',
  navy: '#152238',
  teal: '#18B6A4',
  coral: '#FF8066',
  amber: '#FFB547',
  white: '#FFFFFF',
  slate: '#687386',
} as const;

export const colors = {
  background: palette.cream,
  surface: palette.white,
  surfaceMuted: '#FFF1DF',
  border: '#EFE3D1',

  text: palette.navy,
  textMuted: palette.slate,
  textInverse: palette.white, // on navy surfaces
  textInverseMuted: '#C5CEDD',

  // Teal is light, so text on teal is navy; teal-coloured text uses primaryText.
  primary: palette.teal,
  primaryPressed: '#129C8C',
  primarySoft: '#DDF5F1',
  primaryText: '#0B7468',
  textOnPrimary: palette.navy,

  navy: palette.navy,
  navyPressed: '#24365A',

  accent: palette.coral, // decorative highlights, never body text on cream
  accentSoft: '#FFE6DF',
  accentText: '#B4442C',

  amber: palette.amber,
  amberSoft: '#FFF0D6',
  amberText: '#8A5A00',

  success: '#2E7D5B',
  danger: '#B3261E',
  dangerPressed: '#8C1D17',
  dangerSoft: '#FCE8E6',
  overlayLight: 'rgba(255, 255, 255, 0.14)',
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

// Platform system fonts (SF Pro on iOS, Roboto on Android, the system UI font on web):
// readable, modern, and nothing to license or load.
export const typography = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: '800', letterSpacing: -0.5 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '800', letterSpacing: -0.3 },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  label: { fontSize: 16, lineHeight: 20, fontWeight: '700' },
  stat: { fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -0.5 },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '600', letterSpacing: 0.2 },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

export const shadows = {
  card: { boxShadow: '0px 6px 18px rgba(21, 34, 56, 0.07)' },
  raised: { boxShadow: '0px 12px 28px rgba(21, 34, 56, 0.18)' },
} as const satisfies Record<string, ViewStyle>;

/** Minimum size for anything tappable (Material 48dp, Apple 44pt). */
export const MIN_TOUCH_TARGET = 48;

/** Widest the content column grows on tablets and web. */
export const MAX_CONTENT_WIDTH = 560;
