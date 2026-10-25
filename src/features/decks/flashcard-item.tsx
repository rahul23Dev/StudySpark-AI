import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Badge, Card } from '@/components/ui';
import type { Difficulty, Flashcard } from '@/data/types';
import { colors, MIN_TOUCH_TARGET, radii, spacing } from '@/theme';
import Svg, { Path } from 'react-native-svg';

const DIFFICULTY_TONE: Record<Difficulty, 'primary' | 'accent'> = { easy: 'primary', medium: 'primary', hard: 'accent' };
const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

function Chevron({ up, color }: { up: boolean; color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" aria-hidden>
      <Path
        d={up ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'}
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export type FlashcardItemProps = {
  card: Flashcard;
  index: number;
  total: number;
  onEdit: () => void;
  onMove: (direction: 'up' | 'down') => void;
  busy?: boolean;
};

export function FlashcardItem({ card, index, total, onEdit, onMove, busy }: FlashcardItemProps) {
  const number = index + 1;
  const canUp = index > 0 && !busy;
  const canDown = index < total - 1 && !busy;
  return (
    <Card style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Card ${number}: ${card.front}. Answer: ${card.back}. ${DIFFICULTY_LABEL[card.difficulty]}.`}
        accessibilityHint="Edit this card"
        onPress={onEdit}
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}>
        <AppText variant="caption" color="textMuted">
          Card {number}
        </AppText>
        <AppText variant="label" numberOfLines={3}>
          {card.front}
        </AppText>
        <AppText variant="body" color="textMuted" numberOfLines={3}>
          {card.back}
        </AppText>
        <Badge label={DIFFICULTY_LABEL[card.difficulty]} tone={DIFFICULTY_TONE[card.difficulty]} />
      </Pressable>
      <View style={styles.moves}>
        {(['up', 'down'] as const).map((direction) => {
          const enabled = direction === 'up' ? canUp : canDown;
          return (
            <Pressable
              key={direction}
              accessibilityRole="button"
              accessibilityLabel={`Move card ${number} ${direction}`}
              accessibilityState={{ disabled: !enabled }}
              disabled={!enabled}
              onPress={() => onMove(direction)}
              style={({ pressed }) => [styles.move, pressed && styles.pressed, !enabled && styles.moveDisabled]}>
              <Chevron up={direction === 'up'} color={colors.text} />
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: spacing.sm, padding: spacing.sm },
  body: { flex: 1, gap: spacing.xs, padding: spacing.sm, borderRadius: radii.lg },
  pressed: { backgroundColor: colors.primarySoft },
  moves: { justifyContent: 'center', gap: spacing.xs },
  move: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  moveDisabled: { opacity: 0.35 },
});
