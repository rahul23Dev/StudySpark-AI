import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { colors, MIN_TOUCH_TARGET, radii, spacing } from '@/theme';

import { AppText } from './app-text';

export type SegmentOption<T extends string> = { value: T; label: string };

export type SegmentedControlProps<T extends string> = {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Read by screen readers before each option, e.g. "Sort decks". */
  accessibilityLabel: string;
};

/** A row of selectable pills; scrolls sideways when it doesn't fit. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            aria-checked={selected}
            onPress={() => onChange(option.value)}
            style={[styles.pill, selected && styles.pillSelected]}>
            <AppText variant="caption" color={selected ? 'textInverse' : 'text'}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm },
  pill: {
    minHeight: MIN_TOUCH_TARGET - 4,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillSelected: { backgroundColor: colors.navy, borderColor: colors.navy },
});
