import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import type { ProgressSummary } from '@/study/progress';
import { colors, radii, spacing } from '@/theme';

type Props = { week: ProgressSummary['week']; today: string };

/**
 * Answers per day, Monday to Sunday: flashcards (teal) stacked under quiz answers
 * (coral). Seven flexible columns, so it fits a 320pt-wide screen.
 */
export function WeeklyChart({ week, today }: Props) {
  const max = Math.max(1, ...week.map((d) => d.cards + d.quiz));
  const described = week.map((d) => `${d.label} ${d.cards} cards, ${d.quiz} quiz answers`).join('; ');
  return (
    <View style={styles.wrap}>
      <View style={styles.chart} accessible accessibilityRole="image" accessibilityLabel={`This week: ${described}`}>
        {week.map((d) => {
          const total = d.cards + d.quiz;
          const isToday = d.day === today;
          return (
            <View key={d.day} style={styles.column}>
              <AppText variant="caption" color="textMuted" numberOfLines={1}>
                {total > 0 ? total : ''}
              </AppText>
              <View style={styles.track}>
                {total > 0 ? (
                  <View style={[styles.stack, { height: `${Math.max((total / max) * 100, 8)}%` }]}>
                    {d.quiz > 0 ? <View style={[styles.quiz, { flex: d.quiz }]} /> : null}
                    {d.cards > 0 ? <View style={[styles.cards, { flex: d.cards }]} /> : null}
                  </View>
                ) : null}
              </View>
              <AppText variant="caption" color={isToday ? 'text' : 'textMuted'} style={isToday && styles.today} numberOfLines={1}>
                {d.label}
              </AppText>
            </View>
          );
        })}
      </View>
      <View style={styles.legend} aria-hidden>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, styles.cards]} />
          <AppText variant="caption" color="textMuted">
            Flashcards
          </AppText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, styles.quiz]} />
          <AppText variant="caption" color="textMuted">
            Quiz answers
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs, height: 160 },
  column: { flex: 1, alignItems: 'center', gap: spacing.xs, height: '100%', minWidth: 0 },
  track: {
    flex: 1,
    width: '100%',
    maxWidth: 32,
    justifyContent: 'flex-end',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  stack: { width: '100%', borderRadius: radii.sm, overflow: 'hidden' },
  cards: { backgroundColor: colors.primary },
  quiz: { backgroundColor: colors.accent },
  today: { fontWeight: '800' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  swatch: { width: 12, height: 12, borderRadius: 3 },
});
