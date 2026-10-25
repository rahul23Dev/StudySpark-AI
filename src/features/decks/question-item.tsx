import { StyleSheet } from 'react-native';

import { AppText, Card } from '@/components/ui';
import type { QuizQuestion } from '@/data/types';
import { spacing } from '@/theme';

export function QuestionItem({ question, index, onEdit }: { question: QuizQuestion; index: number; onEdit: () => void }) {
  const kind = question.type === 'true_false' ? 'True or false' : `Multiple choice · ${question.options.length} options`;
  const answer = question.options[question.correctAnswerIndex];
  return (
    <Card
      onPress={onEdit}
      accessibilityLabel={`Question ${index + 1}: ${question.question}. ${kind}. Answer: ${answer}.`}
      accessibilityHint="Edit this question"
      style={styles.card}>
      <AppText variant="caption" color="textMuted">
        Question {index + 1} · {kind}
      </AppText>
      <AppText variant="label" numberOfLines={3}>
        {question.question}
      </AppText>
      <AppText variant="caption" color="primaryText">
        Answer: {answer}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs },
});
