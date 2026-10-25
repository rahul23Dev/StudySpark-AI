import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card, PageHeader, ScreenContainer, StatTile } from '@/components/ui';
import { colors, MIN_TOUCH_TARGET, radii, spacing } from '@/theme';

type Period = 'week' | 'month';

const PERIODS: { id: Period; label: string; buckets: string[] }[] = [
  { id: 'week', label: 'Weekly', buckets: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
  { id: 'month', label: 'Monthly', buckets: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'] },
];

export default function ProgressScreen() {
  const [period, setPeriod] = useState<Period>('week');
  const current = PERIODS.find((p) => p.id === period) ?? PERIODS[0];
  // No study sessions are recorded yet, so every bucket is honestly zero.
  const minutes = current.buckets.map(() => 0);

  return (
    <ScreenContainer>
      <PageHeader title="Progress" subtitle="See how your studying adds up." />

      <Card style={styles.chartCard}>
        <View style={styles.segmented} accessibilityRole="tablist">
          {PERIODS.map((p) => {
            const selected = p.id === period;
            return (
              <Pressable
                key={p.id}
                accessibilityRole="tab"
                aria-selected={selected}
                accessibilityLabel={`${p.label} view`}
                onPress={() => setPeriod(p.id)}
                style={[styles.segment, selected && styles.segmentActive]}>
                <AppText variant="caption" color={selected ? 'textInverse' : 'text'}>
                  {p.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <AppText variant="heading">
          0 minutes this {period === 'week' ? 'week' : 'month'}
        </AppText>

        <View
          style={styles.chart}
          accessible
          accessibilityLabel={`Study minutes per ${period === 'week' ? 'day' : 'week'}: no study time recorded yet.`}>
          {current.buckets.map((bucket, i) => (
            <View key={bucket} style={styles.barColumn}>
              <View style={styles.barTrack}>
                <View style={[styles.bar, { height: `${Math.max(minutes[i], 4)}%` }]} />
              </View>
              <AppText variant="caption" color="textMuted">
                {bucket}
              </AppText>
            </View>
          ))}
        </View>
      </Card>

      <View style={styles.stats}>
        <StatTile label="Lessons completed" value={0} tone="accent" />
        <StatTile label="Day streak" value={0} tone="amber" />
      </View>

      <Card tone="primary">
        <AppText variant="body">Your progress fills in automatically as you study your decks.</AppText>
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  chartCard: { gap: spacing.lg, backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
  segmented: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    padding: spacing.xs,
  },
  segment: {
    minHeight: MIN_TOUCH_TARGET - 8,
    minWidth: 88,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: colors.navy },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, height: 160 },
  barColumn: { flex: 1, alignItems: 'center', gap: spacing.xs, height: '100%' },
  barTrack: {
    flex: 1,
    width: '100%',
    maxWidth: 36,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(255, 128, 102, 0.18)',
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  bar: { width: '100%', backgroundColor: colors.accent, borderRadius: radii.pill },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
