import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { colors, MIN_TOUCH_TARGET, radii, shadows, spacing, type ColorName } from '@/theme';

import { AppText } from './app-text';

export type ButtonVariant = 'primary' | 'secondary' | 'dark' | 'ghost' | 'danger';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  /** Smaller padding for toolbars and headers (still a 48pt touch target). */
  compact?: boolean;
  accessibilityHint?: string;
  testID?: string;
};

const VARIANTS: Record<ButtonVariant, { bg: string; pressed: string; text: ColorName; border?: string }> = {
  primary: { bg: colors.primary, pressed: colors.primaryPressed, text: 'textOnPrimary' },
  secondary: { bg: colors.surface, pressed: colors.primarySoft, text: 'primaryText', border: colors.primary },
  dark: { bg: colors.navy, pressed: colors.navyPressed, text: 'textInverse' },
  ghost: { bg: 'transparent', pressed: colors.primarySoft, text: 'primaryText' },
  danger: { bg: colors.danger, pressed: colors.dangerPressed, text: 'textInverse' },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  compact,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const v = VARIANTS[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        { backgroundColor: pressed ? v.pressed : v.bg },
        v.border ? { borderWidth: 2, borderColor: v.border } : null,
        variant !== 'ghost' && variant !== 'secondary' ? shadows.card : null,
        pressed && styles.pressed,
        inactive && styles.inactive,
      ]}>
      {loading ? <ActivityIndicator color={colors[v.text]} /> : null}
      <AppText variant="label" color={v.text}>
        {label}
      </AppText>
      {icon && !loading ? <View aria-hidden>{icon}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH_TARGET + 4,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  compact: { minHeight: MIN_TOUCH_TARGET, paddingHorizontal: spacing.lg },
  pressed: { transform: [{ scale: 0.98 }] },
  inactive: { opacity: 0.5 },
});
