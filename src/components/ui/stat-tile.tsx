import { StyleSheet } from 'react-native';

import { spacing } from '@/theme';

import { AppText } from './app-text';
import { Card, type CardTone } from './card';

export type StatTileProps = {
  label: string;
  value: string | number;
  tone?: Extract<CardTone, 'primary' | 'accent' | 'amber' | 'surface'>;
};

export function StatTile({ label, value, tone = 'surface' }: StatTileProps) {
  return (
    <Card tone={tone} style={styles.tile} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppText variant="caption" color="textMuted">
        {label}
      </AppText>
      <AppText variant="stat">{value}</AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, gap: spacing.xs, minWidth: 140 },
});
