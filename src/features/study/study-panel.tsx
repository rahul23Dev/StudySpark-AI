import { StyleSheet, View } from 'react-native';

import { QuizIcon, RotateCardIcon } from '@/components/illustrations';
import { AppText, Button, Card } from '@/components/ui';
import type { Score, StudyMode } from '@/study/scoring';
import { colors, radii, spacing } from '@/theme';

export type ActiveSessionSummary = { id: string; score: Score } | null;

type ModeRowProps = {
  mode: StudyMode;
  itemCount: number;
  active: ActiveSessionSummary;
  busy: boolean;
  onStart: (mode: StudyMode) => void;
  onResume: (sessionId: string) => void;
};

function ModeRow({ mode, itemCount, active, busy, onStart, onResume }: ModeRowProps) {
  const isQuiz = mode === 'quiz';
  const noun = isQuiz ? (itemCount === 1 ? 'question' : 'questions') : itemCount === 1 ? 'card' : 'cards';
  const status = active
    ? `In progress · ${active.score.answered} of ${active.score.total} answered`
    : itemCount === 0
      ? isQuiz
        ? 'Add quiz questions to take a quiz'
        : 'Add cards to start studying'
      : `${itemCount} ${noun}`;
  return (
    <View style={styles.row}>
      <View style={styles.icon} aria-hidden>
        {isQuiz ? <QuizIcon width={28} height={28} /> : <RotateCardIcon width={28} height={28} />}
      </View>
      <View style={styles.text}>
        <AppText variant="label">{isQuiz ? 'Quiz' : 'Flashcards'}</AppText>
        <AppText variant="caption" color="textMuted">
          {status}
        </AppText>
        <View style={styles.buttons}>
          {active ? (
            <>
              <Button
                label={isQuiz ? 'Resume quiz' : 'Resume'}
                compact
                disabled={busy}
                onPress={() => onResume(active.id)}
              />
              <Button
                label="Start over"
                variant="ghost"
                compact
                disabled={busy || itemCount === 0}
                onPress={() => onStart(mode)}
              />
            </>
          ) : (
            <Button
              label={isQuiz ? 'Take quiz' : 'Study flashcards'}
              compact
              disabled={busy || itemCount === 0}
              onPress={() => onStart(mode)}
            />
          )}
        </View>
      </View>
    </View>
  );
}

export type StudyPanelProps = {
  cardCount: number;
  questionCount: number;
  activeFlashcards: ActiveSessionSummary;
  activeQuiz: ActiveSessionSummary;
  busy: boolean;
  onStart: (mode: StudyMode) => void;
  onResume: (sessionId: string) => void;
};

export function StudyPanel({ cardCount, questionCount, activeFlashcards, activeQuiz, ...actions }: StudyPanelProps) {
  return (
    <Card style={styles.panel}>
      <ModeRow mode="flashcards" itemCount={cardCount} active={activeFlashcards} {...actions} />
      <View style={styles.divider} />
      <ModeRow mode="quiz" itemCount={questionCount} active={activeQuiz} {...actions} />
    </Card>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
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
  divider: { height: 1, backgroundColor: colors.border },
});
