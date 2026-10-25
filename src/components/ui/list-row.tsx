import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ChevronRightIcon } from '@/components/icons';
import { colors, MIN_TOUCH_TARGET, spacing } from '@/theme';

import { AppText } from './app-text';

export type ListRowProps = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  /** Without onPress the row is plain information (no chevron, not focusable as a button). */
  onPress?: () => void;
  trailing?: ReactNode;
  accessibilityHint?: string;
  selected?: boolean;
};

export function ListRow({ title, subtitle, leading, onPress, trailing, accessibilityHint, selected }: ListRowProps) {
  const body = (
    <>
      {leading ? <View aria-hidden>{leading}</View> : null}
      <View style={styles.text}>
        <AppText variant="label">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" color="textMuted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing}
      {onPress && !trailing ? <ChevronRightIcon color={colors.textMuted} size={20} /> : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={styles.row} accessible accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      aria-selected={selected}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MIN_TOUCH_TARGET + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  pressed: { backgroundColor: colors.primarySoft },
  text: { flex: 1, gap: spacing.xxs },
});
