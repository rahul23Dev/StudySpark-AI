import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  ScreenContainer,
  SegmentedControl,
  StatTile,
} from '@/components/ui';
import { useRepository } from '@/data/database-context';
import { useFocusQuery } from '@/data/use-query';
import { computeStudyStats } from '@/study/stats';
import { colors, radii, spacing } from '@/theme';

type Period = 'week' | 'month';

const PERIODS = [
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
] as const;

export default function ProgressScreen() {
  const repo = useRepository();
  const [period, setPeriod] = useState<Period>('week');
  // Everything here comes from completed sessions saved on the device.
  const load = useCallback(async () => {
    const sessions = await repo.listCompletedSessions();
    const times = sessions.flatMap((s) => (s.completedAt ? [{ startedAt: s.startedAt, completedAt: s.completedAt }] : []));
    return computeStudyStats(times, new Date());
  }, [repo]);
  const stats = useFocusQuery(load);

  if (!stats.data) {
    return (
      <ScreenContainer>
        <PageHeader title="Progress" subtitle="See how your studying adds up." />
        {stats.status === 'error' ? (
          <ErrorState message="We couldn't load your progress." onRetry={stats.reload} />
        ) : (
          <LoadingState message="Adding up your study time…" />
        )}
      </ScreenContainer>
    );
  }

  const data = stats.data;
  const buckets = period === 'week' ? data.week : data.month;
  const total = period === 'week' ? data.minutesThisWeek : data.minutesThisMonth;
  const max = Math.max(1, ...buckets.map((b) => b.minutes));
  const described = buckets.map((b) => `${b.label} ${b.minutes} minutes`).join(', ');

  return (
    <ScreenContainer>
      <PageHeader title="Progress" subtitle="See how your studying adds up." />

      <Card style={styles.chartCard}>
        <SegmentedControl
          accessibilityLabel="Time range"
          options={PERIODS}
          value={period}
          onChange={setPeriod}
        />
        <AppText variant="heading">
          {total} {total === 1 ? 'minute' : 'minutes'} {period === 'week' ? 'this week' : 'in the last 4 weeks'}
        </AppText>
        <View style={styles.chart} accessible accessibilityLabel={`Study minutes: ${described}`}>
          {buckets.map((b) => (
            <View key={b.label} style={styles.barColumn}>
              <AppText variant="caption" color="textMuted">
                {b.minutes > 0 ? b.minutes : ''}
              </AppText>
              <View style={styles.barTrack}>
                <View style={[styles.bar, { height: `${b.minutes > 0 ? Math.max((b.minutes / max) * 100, 6) : 0}%` }]} />
              </View>
              <AppText variant="caption" color="textMuted" numberOfLines={1}>
                {b.label}
              </AppText>
            </View>
          ))}
        </View>
      </Card>

      <View style={styles.stats}>
        <StatTile label="Sessions completed" value={data.sessionsCompleted} tone="accent" />
        <StatTile label="Day streak" value={data.streakDays} tone="amber" />
      </View>

      <Card tone="primary">
        <AppText variant="body">
          {data.sessionsCompleted === 0
            ? 'Finish a flashcard session or quiz and your progress will appear here.'
            : 'Study time counts each completed session, up to an hour per session.'}
        </AppText>
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  chartCard: { gap: spacing.lg, backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, height: 180 },
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
