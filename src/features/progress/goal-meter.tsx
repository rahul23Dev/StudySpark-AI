import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import type { ProgressSummary } from '@/study/progress';
import { colors, radii, spacing } from '@/theme';

/** Today's flashcard reviews against the daily goal, as a bar with a text summary. */
export function GoalMeter({ goal }: { goal: ProgressSummary['goal'] }) {
  const remaining = Math.max(0, goal.target - goal.cardsReviewedToday);
  return (
    <View style={styles.wrap}>
      <AppText variant="heading">
        {goal.cardsReviewedToday} of {goal.target} cards today
      </AppText>
      <View
        style={styles.track}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Daily goal"
        accessibilityValue={{ min: 0, max: goal.target, now: Math.min(goal.cardsReviewedToday, goal.target) }}>
        <View style={[styles.fill, goal.met && styles.met, { width: `${goal.percent}%` }]} />
      </View>
      <AppText variant="caption" color={goal.met ? 'success' : 'textMuted'}>
        {goal.met
          ? 'Goal reached for today. Nice work!'
          : `${remaining} more ${remaining === 1 ? 'card' : 'cards'} to reach your goal.`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  track: { height: 12, borderRadius: radii.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radii.pill, backgroundColor: colors.primary },
  met: { backgroundColor: colors.success },
});
