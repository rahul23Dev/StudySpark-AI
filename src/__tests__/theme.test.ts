import { colors, contrastRatio, MIN_TOUCH_TARGET } from '@/theme';

// WCAG AA: 4.5:1 for normal text.
const AA = 4.5;

describe('theme palette', () => {
  it.each([
    ['text on background', colors.text, colors.background],
    ['text on surface', colors.text, colors.surface],
    ['muted text on background', colors.textMuted, colors.background],
    ['muted text on surface', colors.textMuted, colors.surface],
    ['button label on primary', colors.textOnPrimary, colors.primary],
    ['button label on pressed primary', colors.textOnPrimary, colors.primaryPressed],
    ['primary text on background', colors.primary, colors.background],
    ['primary text on soft primary', colors.primary, colors.primarySoft],
    ['accent text on soft accent', colors.accentText, colors.accentSoft],
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
