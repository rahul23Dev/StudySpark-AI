import { colors, contrastRatio, MIN_TOUCH_TARGET, palette } from '@/theme';

// WCAG AA: 4.5:1 for normal text.
const AA = 4.5;

describe('theme palette', () => {
  it('uses the Phase 1 brand values', () => {
    expect(palette).toEqual({
      cream: '#FFF9F0',
      navy: '#152238',
      teal: '#18B6A4',
      coral: '#FF8066',
      amber: '#FFB547',
      white: '#FFFFFF',
      slate: '#687386',
    });
    expect(colors.background).toBe('#FFF9F0');
    expect(colors.text).toBe('#152238');
    expect(colors.primary).toBe('#18B6A4');
  });

  it.each([
    ['text on background', colors.text, colors.background],
    ['text on surface', colors.text, colors.surface],
    ['muted text on background', colors.textMuted, colors.background],
    ['muted text on surface', colors.textMuted, colors.surface],
    ['button label on teal', colors.textOnPrimary, colors.primary],
    ['button label on pressed teal', colors.textOnPrimary, colors.primaryPressed],
    ['teal text on background', colors.primaryText, colors.background],
    ['teal text on soft teal', colors.primaryText, colors.primarySoft],
    ['coral text on soft coral', colors.accentText, colors.accentSoft],
    ['amber text on soft amber', colors.amberText, colors.amberSoft],
    ['white text on navy', colors.textInverse, colors.navy],
    ['muted text on navy', colors.textInverseMuted, colors.navy],
    ['error text on background', colors.danger, colors.background],
  ])('%s meets WCAG AA', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA);
  });

  it('computes known contrast ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('rejects malformed colours', () => {
    expect(() => contrastRatio('teal', '#FFFFFF')).toThrow();
  });

  it('keeps touch targets at least 48 points', () => {
    expect(MIN_TOUCH_TARGET).toBeGreaterThanOrEqual(48);
  });
});
