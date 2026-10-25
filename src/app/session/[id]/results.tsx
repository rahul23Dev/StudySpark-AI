import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { artwork } from '@/components/artwork';
import { AppText, Button, Card, ErrorState, LoadingState, ScreenContainer, SectionTitle } from '@/components/ui';
import { useRepository } from '@/data/database-context';
import type { SessionItem } from '@/data/sessions';
import { useFocusQuery } from '@/data/use-query';
import { SaveError, saveErrorMessage } from '@/features/study/study-chrome';
import { decodeQuizAnswer } from '@/study/scoring';
import { sessionMinutes } from '@/study/stats';
import { spacing } from '@/theme';

function ReviewItem({ item }: { item: SessionItem }) {
  if (item.kind === 'flashcard') {
    return (
      <Card style={styles.review}>
        {item.card ? (
          <>
            <AppText variant="label">{item.card.front}</AppText>
            <AppText variant="body" color="textMuted">
              {item.card.back}
            </AppText>
            <AppText variant="caption" color="accentText">
              {item.attempt ? 'Marked for review' : 'Not answered'}
            </AppText>
          </>
        ) : (
          <AppText variant="body" color="textMuted">
            This card was deleted.
          </AppText>
        )}
      </Card>
    );
  }
  const q = item.question;
  if (!q) {
    return (
      <Card style={styles.review}>
        <AppText variant="body" color="textMuted">
          This question was deleted.
        </AppText>
      </Card>
    );
  }
  const yours = item.attempt ? q.options[decodeQuizAnswer(item.attempt.submittedAnswer, q.options.length)] : null;
  return (
    <Card style={styles.review}>
      <AppText variant="label">{q.question}</AppText>
      <AppText variant="body" color="accentText">
        Your answer: {yours ?? 'not answered'}
      </AppText>
      <AppText variant="body" color="primaryText">
        Correct answer: {q.options[q.correctAnswerIndex]}
      </AppText>
      {q.explanation ? (
        <AppText variant="body" color="textMuted">
          {q.explanation}
        </AppText>
      ) : null}
    </Card>
  );
}

export default function SessionResultsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const repo = useRepository();
  const load = useCallback(() => repo.getSessionDetail(id), [repo, id]);
  const query = useFocusQuery(load);
  const [restarting, setRestarting] = useState(false);
  const [restartError, setRestartError] = useState<string | null>(null);

  const shell = (children: React.ReactNode) => (
    <ScreenContainer edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'Results' }} />
      {children}
    </ScreenContainer>
  );

  if (!query.data) {
    return shell(
      query.status === 'loading' ? (
        <LoadingState message="Adding up your score…" />
      ) : (
        <ErrorState message="We couldn't load these results." onRetry={query.reload} />
      ),
    );
  }

  const { session, deck, items, score } = query.data;
  const isQuiz = session.mode === 'quiz';
  const toReview = items.filter((i) => !i.attempt || !i.attempt.isCorrect);
  const minutes = session.completedAt
    ? Math.max(1, Math.round(sessionMinutes({ startedAt: session.startedAt, completedAt: session.completedAt })))
    : null;
  const art = score.perfect ? artwork.studyCelebration : isQuiz ? artwork.quizComplete : artwork.studyCelebration;

  async function studyAgain() {
    if (!deck) return;
    setRestarting(true);
    setRestartError(null);
    try {
      const next = await repo.startSession(deck.id, session.mode);
      router.replace(`/session/${next.id}`);
    } catch (error) {
      setRestartError(saveErrorMessage(error, 'a new session'));
    } finally {
      setRestarting(false);
    }
  }

  return shell(
    <>
      <Card style={styles.summary}>
        <View style={styles.art} aria-hidden>
          <Image source={art.source} style={styles.fill} contentFit="contain" />
        </View>
        <AppText variant="caption" color="textMuted">
          {isQuiz ? 'QUIZ RESULTS' : 'FLASHCARD RESULTS'}
          {deck ? ` · ${deck.title.toUpperCase()}` : ''}
        </AppText>
        <AppText
          variant="display"
          accessibilityRole="header"
          accessibilityLabel={`Score: ${score.correct} out of ${score.total}${score.percent !== null ? `, ${score.percent} percent` : ''}`}>
          {score.correct} / {score.total}
        </AppText>
        <AppText variant="heading" color="primaryText">
          {score.perfect
            ? 'Perfect score!'
            : score.percent === null
              ? 'Nothing to score'
              : `${score.percent}% ${isQuiz ? 'correct' : 'known'}`}
        </AppText>
        <AppText variant="caption" color="textMuted">
          {isQuiz ? 'Correct' : 'Known'} {score.correct} · {isQuiz ? 'Incorrect' : 'To review'} {score.incorrect}
          {score.unanswered ? ` · Skipped ${score.unanswered}` : ''}
          {minutes ? ` · ${minutes} min` : ''}
        </AppText>
        {session.status !== 'completed' ? (
          <AppText variant="caption" color="accentText">
            This session hasn&apos;t been completed yet.
          </AppText>
        ) : null}
      </Card>

      {toReview.length > 0 ? (
        <View style={styles.list}>
          <SectionTitle>{isQuiz ? `Review (${toReview.length})` : `Cards to review (${toReview.length})`}</SectionTitle>
          {toReview.map((item) => (
            <ReviewItem key={item.itemId} item={item} />
          ))}
        </View>
      ) : null}

      {restartError ? <SaveError message={restartError} onRetry={studyAgain} /> : null}
      <View style={styles.actions}>
        {deck ? (
          <Button label={isQuiz ? 'Retake quiz' : 'Study again'} loading={restarting} onPress={studyAgain} />
        ) : null}
        <Button
          label="Back to deck"
          variant="secondary"
          onPress={() => (deck ? router.dismissTo(`/deck/${deck.id}`) : router.navigate('/decks'))}
        />
      </View>
    </>,
  );
}

const styles = StyleSheet.create({
  summary: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
  art: { width: '70%', maxWidth: 240, aspectRatio: 4 / 3 },
  fill: { width: '100%', height: '100%' },
  list: { gap: spacing.md },
  review: { gap: spacing.xs },
  actions: { gap: spacing.md },
});
