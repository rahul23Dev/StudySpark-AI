import { StyleSheet, View } from 'react-native';

import { ReviewCalendarIcon } from '@/components/illustrations';
import { AppText, Button, Card } from '@/components/ui';
import { colors, radii, spacing } from '@/theme';

export type ReviewCounts = {
  /** Reviewed cards whose next review time has passed. */
  due: number;
  /** Cards never reviewed (due immediately). */
  newCards: number;
  /** Cards with a stored schedule (what a reset would clear). */
  scheduled: number;
};

type Props = {
  counts: ReviewCounts;
  busy: boolean;
  onReview: () => void;
  onReset: () => void;
};

/** Spaced repetition for one deck: what's due now, and a manual schedule reset. */
export function ReviewPanel({ counts, busy, onReview, onReset }: Props) {
  const total = counts.due + counts.newCards;
  const parts = [counts.due > 0 ? `${counts.due} due` : null, counts.newCards > 0 ? `${counts.newCards} new` : null].filter(
    Boolean,
  );
  return (
    <Card style={styles.card}>
      <View style={styles.icon} aria-hidden>
        <ReviewCalendarIcon width={28} height={28} />
      </View>
      <View style={styles.text}>
        <AppText variant="label">Spaced review</AppText>
        <AppText variant="caption" color="textMuted">
          {total === 0 ? 'All caught up. Nothing is due right now.' : `${parts.join(' · ')} to review now`}
        </AppText>
        <View style={styles.buttons}>
          <Button label="Review due cards" compact disabled={busy || total === 0} onPress={onReview} />
          <Button
            label="Reset schedule"
            variant="ghost"
            compact
            disabled={busy || counts.scheduled === 0}
            accessibilityHint="Makes every card in this deck new again. Your answer history is kept."
            onPress={onReset}
          />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  icon: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: spacing.xs },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
});
