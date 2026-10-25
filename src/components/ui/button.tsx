import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, MIN_TOUCH_TARGET, radii, shadows, spacing } from '@/theme';

import { AppText } from './app-text';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  icon?: ReactNode;
  disabled?: boolean;
  accessibilityHint?: string;
};

export function Button({ label, onPress, variant = 'primary', icon, disabled, accessibilityHint }: ButtonProps) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.secondary,
        pressed && (primary ? styles.primaryPressed : styles.secondaryPressed),
        disabled && styles.disabled,
      ]}>
      <AppText variant="label" color={primary ? 'textOnPrimary' : 'primary'}>
        {label}
      </AppText>
      {icon ? <View aria-hidden>{icon}</View> : null}
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
  primary: { backgroundColor: colors.primary, ...shadows.card },
  primaryPressed: { backgroundColor: colors.primaryPressed, transform: [{ scale: 0.98 }] },
  secondary: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.primary },
  secondaryPressed: { backgroundColor: colors.primarySoft },
  disabled: { opacity: 0.5 },
});
