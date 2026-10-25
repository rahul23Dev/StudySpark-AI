import { Pressable, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { colors, radii, shadows, spacing } from '@/theme';

export type CardTone = 'surface' | 'navy' | 'primary' | 'accent' | 'amber';

const TONES: Record<CardTone, ViewStyle> = {
  surface: { backgroundColor: colors.surface, borderColor: colors.border },
  navy: { backgroundColor: colors.navy, borderColor: colors.navy },
  primary: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  accent: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
  amber: { backgroundColor: colors.amberSoft, borderColor: colors.amberSoft },
};

export type CardProps = ViewProps & {
  tone?: CardTone;
  /** Makes the whole card a button. Give it an accessibilityLabel describing the action. */
  onPress?: () => void;
};

export function Card({ tone = 'surface', onPress, style, children, ...rest }: CardProps) {
  const base: StyleProp<ViewStyle> = [styles.card, TONES[tone], style];
  if (!onPress) {
    return (
      <View style={base} {...rest}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [base, pressed && styles.pressed]}
      {...rest}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    ...shadows.card,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
