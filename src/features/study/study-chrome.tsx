import { Pressable, StyleSheet, View } from 'react-native';

import { ChevronRightIcon } from '@/components/icons';
import { AppText, Button } from '@/components/ui';
import { NotFoundError, ValidationError } from '@/data/errors';
import { colors, MIN_TOUCH_TARGET, radii, spacing } from '@/theme';

/** "Card 3 of 10" plus a bar showing how many are answered. */
export function StudyProgress({ label, index, total, answered }: { label: string; index: number; total: number; answered: number }) {
  const pct = total === 0 ? 0 : Math.round((answered / total) * 100);
  return (
    <View style={styles.progress}>
      <View style={styles.progressText}>
        <AppText variant="label" accessibilityRole="header">
          {label} {Math.min(index + 1, total)} of {total}
        </AppText>
        <AppText variant="caption" color="textMuted">
          {answered} answered
        </AppText>
      </View>
      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityLabel={`${answered} of ${total} answered`}
        accessibilityValue={{ min: 0, max: total, now: answered }}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

function Arrow({ left }: { left?: boolean }) {
  return (
    <View style={left ? styles.flip : undefined}>
      <ChevronRightIcon color={colors.text} size={22} />
    </View>
  );
}

/** Previous / next buttons with large touch targets. */
export function PrevNext({
  onPrevious,
  onNext,
  canPrevious,
  canNext,
  noun,
}: {
  onPrevious: () => void;
  onNext: () => void;
  canPrevious: boolean;
  canNext: boolean;
  noun: string;
}) {
  return (
    <View style={styles.prevNext}>
      {[
        // "Go to…" keeps these distinct from the quiz's "Next question" continue button.
        { label: `Go to previous ${noun}`, onPress: onPrevious, enabled: canPrevious, left: true },
        { label: `Go to next ${noun}`, onPress: onNext, enabled: canNext, left: false },
      ].map(({ label, onPress, enabled, left }) => (
        <Pressable
          key={label}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled: !enabled }}
          disabled={!enabled}
          onPress={onPress}
          style={({ pressed }) => [styles.navButton, pressed && styles.navPressed, !enabled && styles.navDisabled]}>
          {left ? <Arrow left /> : null}
          <AppText variant="label">{left ? 'Previous' : 'Next'}</AppText>
          {left ? null : <Arrow />}
        </Pressable>
      ))}
    </View>
  );
}

/** A failed save, with a retry that is safe to press (saving is idempotent). */
export function SaveError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.saveError} accessibilityRole="alert">
      <AppText variant="body" color="danger" style={styles.flex}>
        {message}
      </AppText>
      {onRetry ? <Button label="Try again" variant="secondary" compact onPress={onRetry} /> : null}
    </View>
  );
}

/** A user-facing message for a failed save. */
export function saveErrorMessage(error: unknown, what = 'your answer'): string {
  if (error instanceof ValidationError) return Object.values(error.issues)[0] ?? `Couldn't save ${what}.`;
  if (error instanceof NotFoundError) return 'This session no longer exists.';
  return `Couldn't save ${what}. Nothing was lost — please try again.`;
}

const styles = StyleSheet.create({
  progress: { gap: spacing.sm },
  progressText: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  track: { height: 10, borderRadius: radii.pill, backgroundColor: colors.primarySoft, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radii.pill, backgroundColor: colors.primary },
  prevNext: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  navButton: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
  },
  navPressed: { backgroundColor: colors.primarySoft },
  navDisabled: { opacity: 0.4 },
  flip: { transform: [{ scaleX: -1 }] },
  saveError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.dangerSoft,
  },
  flex: { flex: 1 },
});
