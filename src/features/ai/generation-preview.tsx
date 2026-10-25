import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Card } from '@/components/ui';
import type { FlashcardGeneration, QuizGeneration } from '@/ai/client';
import { spacing } from '@/theme';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Read-only preview of generated content, shown before anything is saved. */
export function GenerationPreview({ generation }: { generation: FlashcardGeneration | QuizGeneration }) {
  if (generation.kind === 'flashcards') {
    return (
      <View style={styles.list}>
        {generation.deck.cards.map((card, i) => (
          <Card key={i} style={styles.item}>
            <AppText variant="caption" color="textMuted">
              Card {i + 1} · {card.difficulty}
            </AppText>
            <AppText variant="label">{card.question}</AppText>
            <AppText variant="body" color="textMuted">
              {card.answer}
            </AppText>
            {card.sourceQuote ? <SourceQuote quote={card.sourceQuote} /> : null}
          </Card>
        ))}
      </View>
    );
  }
  return (
    <View style={styles.list}>
      {generation.quiz.questions.map((q, i) => (
        <Card key={i} style={styles.item}>
          <AppText variant="caption" color="textMuted">
            Question {i + 1} · {q.type === 'true_false' ? 'True or false' : 'Multiple choice'}
          </AppText>
          <AppText variant="label">{q.question}</AppText>
          {q.options.map((option, j) => (
            <AppText key={j} variant="body" color={j === q.correctAnswerIndex ? 'primaryText' : 'textMuted'}>
              {LETTERS[j]}. {option}
              {j === q.correctAnswerIndex ? '  ✓' : ''}
            </AppText>
          ))}
          <AppText variant="caption" color="textMuted">
            {q.explanation}
          </AppText>
          {q.sourceQuote ? <SourceQuote quote={q.sourceQuote} /> : null}
        </Card>
      ))}
    </View>
  );
}

function SourceQuote({ quote }: { quote: string }) {
  return (
    <View style={styles.source}>
      <Badge label="From your notes" tone="primary" />
      <AppText variant="caption" color="textMuted">
        “{quote}”
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  item: { gap: spacing.xs },
  source: { gap: spacing.xs, marginTop: spacing.xs },
});
