import { useMemo, useReducer, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CheckIcon } from '@/components/icons';
import { RotateCardIcon } from '@/components/illustrations';
import { AppText, Badge, Button } from '@/components/ui';
import type { SessionItem } from '@/data/sessions';
import { FLASHCARD_ANSWERS, type FlashcardAnswer } from '@/study/scoring';
import { initialPlayerState, nextUnansweredIndex, playerReducer, resumeIndex } from '@/study/session-state';
import { colors, radii, shadows, spacing } from '@/theme';

import { PrevNext, SaveError, saveErrorMessage, StudyProgress } from './study-chrome';
import { useKeyboardShortcuts } from './use-keyboard-shortcuts';

type FlashcardItem = Extract<SessionItem, { kind: 'flashcard' }>;

export type FlashcardPlayerProps = {
  items: FlashcardItem[];
  /** Saves an answer; throws if the save fails. */
  onAnswer: (itemId: string, answer: FlashcardAnswer) => Promise<void>;
  onShuffle: () => Promise<string[]>;
  /** Called when every card has an answer. */
  onAllAnswered: () => void;
};

export function FlashcardPlayer({ items, onAnswer, onShuffle, onAllAnswered }: FlashcardPlayerProps) {
  const ids = useMemo(() => items.map((i) => i.itemId), [items]);
  const answered = useMemo(() => new Set(items.filter((i) => i.attempt).map((i) => i.itemId)), [items]);
  const [state, dispatch] = useReducer(playerReducer, undefined, () =>
    initialPlayerState(items.length, resumeIndex(ids, answered)),
  );
  // Belt and braces with the reducer's guard: blocks a second tap before React re-renders.
  const inFlight = useRef(false);
  const shuffling = useRef(false);
  // Kept for the "Try again" button after a failed save.
  const [lastAnswer, setLastAnswer] = useState<FlashcardAnswer | null>(null);

  const item = items[state.index];
  const card = item?.card ?? null;
  const attempt = item?.attempt ?? null;

  async function answer(value: FlashcardAnswer) {
    if (!item || inFlight.current || attempt || !card) return;
    inFlight.current = true;
    setLastAnswer(value);
    dispatch({ type: 'submitStart' });
    try {
      await onAnswer(item.itemId, value);
      dispatch({ type: 'submitSuccess', advance: false });
      const next = nextUnansweredIndex(ids, new Set([...answered, item.itemId]), state.index);
      if (next === null) onAllAnswered();
      else dispatch({ type: 'goTo', index: next });
    } catch (error) {
      dispatch({ type: 'submitFailure', error: saveErrorMessage(error) });
    } finally {
      inFlight.current = false;
    }
  }

  async function shuffle() {
    if (shuffling.current || inFlight.current) return;
    shuffling.current = true;
    try {
      const order = await onShuffle();
      dispatch({ type: 'reset', count: order.length, index: resumeIndex(order, answered) });
    } catch (error) {
      dispatch({ type: 'submitFailure', error: saveErrorMessage(error, 'the new order') });
    } finally {
      shuffling.current = false;
    }
  }

  const canAnswer = state.revealed && !attempt && !!card && !state.submitting;
  useKeyboardShortcuts({
    ' ': () => dispatch({ type: state.revealed ? 'hide' : 'reveal' }),
    Enter: () => dispatch({ type: 'reveal' }),
    ArrowLeft: () => dispatch({ type: 'previous' }),
    ArrowRight: () => dispatch({ type: 'next' }),
    k: () => canAnswer && answer(FLASHCARD_ANSWERS.know),
    r: () => canAnswer && answer(FLASHCARD_ANSWERS.review),
  });

  if (!item) return null;

  return (
    <View style={styles.player}>
      <View style={styles.topRow}>
        <View style={styles.flex}>
          <StudyProgress label="Card" index={state.index} total={items.length} answered={answered.size} />
        </View>
      </View>
      <Button
        label="Shuffle remaining"
        variant="ghost"
        compact
        disabled={answered.size >= items.length - 1 || state.submitting}
        onPress={shuffle}
        accessibilityHint="Mixes up the cards you haven't answered yet"
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          card
            ? state.revealed
              ? `Question: ${card.front}. Answer: ${card.back}`
              : `Question: ${card.front}`
            : 'This card was deleted from the deck'
        }
        accessibilityHint={card ? (state.revealed ? 'Hides the answer' : 'Shows the answer') : undefined}
        disabled={!card}
        onPress={() => dispatch({ type: state.revealed ? 'hide' : 'reveal' })}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
        {card ? (
          <>
            <AppText variant="caption" color="textMuted">
              QUESTION
            </AppText>
            <AppText variant="title" style={styles.center}>
              {card.front}
            </AppText>
            {state.revealed ? (
              <View style={styles.answer} accessibilityLiveRegion="polite">
                <View style={styles.divider} />
                <AppText variant="caption" color="primaryText">
                  ANSWER
                </AppText>
                <AppText variant="heading" style={styles.center}>
                  {card.back}
                </AppText>
              </View>
            ) : (
              <AppText variant="caption" color="textMuted" style={styles.hint}>
                Tap the card to show the answer
              </AppText>
            )}
          </>
        ) : (
          <AppText variant="body" color="textMuted" style={styles.center}>
            This card was deleted from the deck. Skip to the next one.
          </AppText>
        )}
      </Pressable>

      {attempt ? (
        <View style={styles.answeredRow} accessibilityLiveRegion="polite">
          <Badge
            label={attempt.isCorrect ? 'You knew this one' : 'Marked for review'}
            tone={attempt.isCorrect ? 'primary' : 'accent'}
          />
          {attempt.isCorrect ? <CheckIcon color={colors.primaryText} size={20} /> : null}
        </View>
      ) : card && !state.revealed ? (
        <Button
          label="Show answer"
          icon={<RotateCardIcon width={22} height={22} />}
          onPress={() => dispatch({ type: 'reveal' })}
        />
      ) : card ? (
        <View style={styles.choices}>
          <View style={styles.flex}>
            <Button
              label="Review again"
              variant="secondary"
              disabled={state.submitting}
              onPress={() => answer(FLASHCARD_ANSWERS.review)}
              accessibilityHint="Saves this card as one to study again"
            />
          </View>
          <View style={styles.flex}>
            <Button
              label="Know it"
              loading={state.submitting}
              onPress={() => answer(FLASHCARD_ANSWERS.know)}
              accessibilityHint="Saves this card as known"
            />
          </View>
        </View>
      ) : null}

      {state.error ? (
        <SaveError
          message={state.error}
          onRetry={lastAnswer && !attempt ? () => answer(lastAnswer) : undefined}
        />
      ) : null}

      <PrevNext
        noun="card"
        canPrevious={state.index > 0 && !state.submitting}
        canNext={state.index < items.length - 1 && !state.submitting}
        onPrevious={() => dispatch({ type: 'previous' })}
        onNext={() => dispatch({ type: 'next' })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  player: { gap: spacing.lg },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  card: {
    minHeight: 280,
    padding: spacing.xl,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    ...shadows.raised,
  },
  cardPressed: { borderColor: colors.primary },
  center: { textAlign: 'center' },
  hint: { marginTop: spacing.md },
  answer: { alignItems: 'center', gap: spacing.sm, alignSelf: 'stretch' },
  divider: { height: 2, alignSelf: 'stretch', backgroundColor: colors.border, marginVertical: spacing.sm },
  answeredRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 52 },
  choices: { flexDirection: 'row', gap: spacing.md },
});
