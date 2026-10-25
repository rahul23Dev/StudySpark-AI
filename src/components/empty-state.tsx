import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radii, spacing } from '@/theme';

import { ILLUSTRATION_ASPECT_RATIO } from './illustrations';
import { AppText } from './ui';

export type EmptyStateProps = {
  title: string;
  message: string;
  illustration: ReactNode;
  /** Width / height of the illustration; defaults to the SVG illustrations' 4:3. */
  aspectRatio?: number;
  action?: ReactNode;
};

export function EmptyState({
  title,
  message,
  illustration,
  aspectRatio = ILLUSTRATION_ASPECT_RATIO,
  action,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.artCard} aria-hidden>
        <View style={[styles.art, { aspectRatio }]}>{illustration}</View>
      </View>
      <AppText variant="heading" style={styles.center} accessibilityRole="header">
        {title}
      </AppText>
      <AppText variant="body" color="textMuted" style={styles.center}>
        {message}
      </AppText>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  artCard: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.md },
  art: { width: 160 },
  center: { textAlign: 'center' },
});
