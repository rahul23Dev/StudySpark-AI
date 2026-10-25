import { useMemo, useReducer, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CheckIcon } from '@/components/icons';
import { CheckAnswerIcon } from '@/components/illustrations';
import { AppText, Button, Card } from '@/components/ui';
import type { SessionItem } from '@/data/sessions';
import { decodeQuizAnswer, encodeQuizAnswer } from '@/study/scoring';
import { initialPlayerState, nextUnansweredIndex, playerReducer, resumeIndex } from '@/study/session-state';
import { colors, MIN_TOUCH_TARGET, radii, spacing } from '@/theme';

import { PrevNext, SaveError, saveErrorMessage, StudyProgress } from './study-chrome';
import { useKeyboardShortcuts } from './use-keyboard-shortcuts';

type QuestionItem = Extract<SessionItem, { kind: 'question' }>;

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export type QuizPlayerProps = {
  items: QuestionItem[];
  /** Saves an answer (the option index); throws if the save fails. */
  onAnswer: (itemId: string, answer: string) => Promise<void>;
  onAllAnswered: () => void;
};

export function QuizPlayer({ items, onAnswer, onAllAnswered }: QuizPlayerProps) {
  const ids = useMemo(() => items.map((i) => i.itemId), [items]);
  const answered = useMemo(() => new Set(items.filter((i) => i.attempt).map((i) => i.itemId)), [items]);
  const [state, dispatch] = useReducer(playerReducer, undefined, () =>
    initialPlayerState(items.length, resumeIndex(ids, answered)),
  );
  const inFlight = useRef(false);

  const item = items[state.index];
  const question = item?.question ?? null;
  const attempt = item?.attempt ?? null;
  const chosen = attempt && question ? decodeQuizAnswer(attempt.submittedAnswer, question.options.length) : null;
  const nextIndex = nextUnansweredIndex(ids, answered, state.index);

  async function check() {
    if (!item || !question || attempt || state.selectedOption === null || inFlight.current) return;
    inFlight.current = true;
    dispatch({ type: 'submitStart' });
    try {
      await onAnswer(item.itemId, encodeQuizAnswer(state.selectedOption));
      dispatch({ type: 'submitSuccess', advance: false });
    } catch (error) {
      dispatch({ type: 'submitFailure', error: saveErrorMessage(error) });
    } finally {
      inFlight.current = false;
    }
  }

  function goOn() {
    if (nextIndex === null) onAllAnswered();
    else dispatch({ type: 'goTo', index: nextIndex });
  }

  // Built in one expression (not mutated after creation) so the React Compiler can memoise it safely.
  const shortcuts: Record<string, () => void> = {
    ArrowLeft: () => dispatch({ type: 'previous' }),
    ArrowRight: () => dispatch({ type: 'next' }),
    Enter: () => (attempt ? goOn() : check()),
    ...Object.fromEntries(
      (question?.options ?? []).map((_, i) => [String(i + 1), () => !attempt && dispatch({ type: 'select', option: i })]),
    ),
  };
  useKeyboardShortcuts(shortcuts);

  if (!item) return null;

  return (
    <View style={styles.player}>
      <StudyProgress label="Question" index={state.index} total={items.length} answered={answered.size} />

      {question ? (
        <>
          <Card style={styles.questionCard}>
            <AppText variant="caption" color="textMuted">
              {question.type === 'true_false' ? 'TRUE OR FALSE' : 'MULTIPLE CHOICE'}
            </AppText>
            <AppText variant="title" accessibilityRole="header">
              {question.question}
            </AppText>
          </Card>

          <View accessibilityRole="radiogroup" accessibilityLabel="Answer options" style={styles.options}>
            {question.options.map((option, i) => {
              const isCorrect = i === question.correctAnswerIndex;
              const selected = attempt ? chosen === i : state.selectedOption === i;
              const showRight = !!attempt && isCorrect;
              const showWrong = !!attempt && chosen === i && !isCorrect;
              const status = showRight ? ', correct answer' : showWrong ? ', your answer, incorrect' : '';
              return (
                <Pressable
                  key={i}
                  accessibilityRole="radio"
                  aria-checked={selected}
                  accessibilityState={{ disabled: !!attempt || state.submitting }}
                  accessibilityLabel={`${LETTERS[i]}: ${option}${status}`}
                  disabled={!!attempt || state.submitting}
                  onPress={() => dispatch({ type: 'select', option: i })}
                  style={({ pressed }) => [
                    styles.option,
                    selected && !attempt && styles.optionSelected,
                    showRight && styles.optionRight,
                    showWrong && styles.optionWrong,
                    pressed && styles.optionPressed,
                  ]}>
                  <View style={[styles.letter, selected && !attempt && styles.letterSelected, showRight && styles.letterRight]}>
                    <AppText variant="label" color={(selected && !attempt) || showRight ? 'textInverse' : 'text'}>
                      {LETTERS[i]}
                    </AppText>
                  </View>
                  <AppText variant="body" style={styles.flex}>
                    {option}
                  </AppText>
                  {showRight ? <CheckIcon color={colors.primaryText} size={22} /> : null}
                </Pressable>
              );
            })}
          </View>

          {attempt ? (
            <Card tone={attempt.isCorrect ? 'primary' : 'accent'} style={styles.feedback} accessibilityLiveRegion="polite">
              <AppText variant="heading" color={attempt.isCorrect ? 'primaryText' : 'accentText'}>
                {attempt.isCorrect ? 'Correct!' : 'Not quite'}
              </AppText>
              {!attempt.isCorrect ? (
                <AppText variant="body">
                  The answer is {LETTERS[question.correctAnswerIndex]}: {question.options[question.correctAnswerIndex]}.
                </AppText>
              ) : null}
              {question.explanation ? (
                <AppText variant="body" color="textMuted">
                  {question.explanation}
                </AppText>
              ) : null}
              <Button label={nextIndex === null ? 'See results' : 'Next question'} onPress={goOn} />
            </Card>
          ) : (
            <Button
              label="Check answer"
              icon={<CheckAnswerIcon width={22} height={22} />}
              disabled={state.selectedOption === null}
              loading={state.submitting}
              onPress={check}
            />
          )}
        </>
      ) : (
        <Card>
          <AppText variant="body" color="textMuted">
            This question was deleted from the deck. Skip to the next one.
          </AppText>
        </Card>
      )}

      {state.error ? <SaveError message={state.error} onRetry={attempt ? undefined : check} /> : null}

      <PrevNext
        noun="question"
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
  flex: { flex: 1 },
  questionCard: { gap: spacing.sm },
  options: { gap: spacing.sm },
  option: {
    minHeight: MIN_TOUCH_TARGET + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.navy },
  optionRight: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionWrong: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  optionPressed: { opacity: 0.85 },
  letter: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterSelected: { backgroundColor: colors.navy },
  letterRight: { backgroundColor: colors.primaryText },
  feedback: { gap: spacing.sm },
});
