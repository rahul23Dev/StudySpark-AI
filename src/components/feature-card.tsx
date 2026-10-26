import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { StudyFeature } from '@/features/catalog';
import { colors, radii, spacing } from '@/theme';

import { AppText, Badge, Card } from './ui';

export type FeatureCardProps = {
  feature: StudyFeature;
  illustration: ReactNode;
  /** Opens the tool (available tools only). */
  onPress?: () => void;
};

export function FeatureCard({ feature, illustration, onPress }: FeatureCardProps) {
  const planned = feature.status === 'planned';
  return (
    <Card
      style={styles.card}
      accessible
      onPress={planned ? undefined : onPress}
      accessibilityLabel={`${feature.title}. ${feature.description}${planned ? ' Coming soon.' : ''}`}>
      <View style={styles.art}>{illustration}</View>
      <View style={styles.body}>
        <AppText variant="heading">{feature.title}</AppText>
        <AppText variant="body" color="textMuted">
          {feature.description}
        </AppText>
        {planned ? <Badge label="Coming soon" /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  art: {
    width: 80,
    height: 80,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  body: { flex: 1, gap: spacing.xs },
});
