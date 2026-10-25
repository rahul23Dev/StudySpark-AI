import { Image } from 'expo-image';
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { artwork } from '@/components/artwork';
import {
  AppText,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  ScreenContainer,
} from '@/components/ui';
import { useRepository } from '@/data/database-context';
import { NotFoundError } from '@/data/errors';
import type { SessionDetail, SessionItem, StudyAttempt } from '@/data/sessions';
import { useFocusQuery } from '@/data/use-query';
import { FlashcardPlayer } from '@/features/study/flashcard-player';
import { QuizPlayer } from '@/features/study/quiz-player';
import { SaveError, saveErrorMessage } from '@/features/study/study-chrome';
import { computeScore } from '@/study/scoring';
import { spacing } from '@/theme';

export default function StudySessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const repo = useRepository();

  const load = useCallback(() => repo.getSessionDetail(id), [repo, id]);
  const query = useFocusQuery(load);
  // Answers saved during this visit, shown straight away (they are the stored, graded attempts).
  const [saved, setSaved] = useState<Record<string, StudyAttempt>>({});
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);

  const detail = useMemo<SessionDetail | null>(() => {
    if (!query.data) return null;
    const items = query.data.items.map((i) =>
      !i.attempt && saved[i.itemId] ? ({ ...i, attempt: saved[i.itemId] } as SessionItem) : i,
    );
    const attempts = items.flatMap((i) => (i.attempt ? [i.attempt] : []));
    return { ...query.data, items, score: computeScore(items.map((i) => i.itemId), attempts) };
  }, [query.data, saved]);

  /** Saves an answer, then shows it from what was stored (the repository grades it). */
  const answer = useCallback(
    async (itemId: string, value: string) => {
      const { attempt } = await repo.recordAttempt(id, itemId, value);
      setSaved((s) => ({ ...s, [itemId]: attempt }));
    },
    [repo, id],
  );

  const finish = useCallback(async () => {
    setFinishing(true);
    setFinishError(null);
    try {
      await repo.completeSession(id);
      router.replace(`/session/${id}/results`);
    } catch (error) {
      setFinishError(saveErrorMessage(error, 'your results'));
    } finally {
      setFinishing(false);
    }
  }, [repo, id, router]);

  const { reload } = query;
  const shuffle = useCallback(async () => {
    const order = await repo.shuffleRemaining(id);
    await reload();
    return order;
  }, [repo, id, reload]);

  async function endSession() {
    setEnding(true);
    setEndError(null);
    try {
      await repo.abandonSession(id);
      setConfirmEnd(false);
      router.back();
    } catch (error) {
      setEndError(saveErrorMessage(error, 'the change'));
      setConfirmEnd(false);
    } finally {
      setEnding(false);
    }
  }

  const title = detail?.deck?.title ?? 'Study';
  const shell = (children: React.ReactNode) => (
    <ScreenContainer edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title }} />
      {children}
    </ScreenContainer>
  );

  if (!detail) {
    if (query.status === 'loading') return shell(<LoadingState message="Loading your session…" />);
    if (query.status === 'error' && query.error instanceof NotFoundError) {
      return shell(
        <EmptyState
          title="Session not found"
          message="It may have been removed along with its deck."
          action={<Button label="Back" variant="secondary" onPress={() => router.back()} />}
        />,
      );
    }
    return shell(<ErrorState message="We couldn't load this session." onRetry={query.reload} />);
  }

  const { session, items, score } = detail;
  if (session.status === 'completed') return <Redirect href={`/session/${id}/results`} />;
  const mode = session.mode;

  if (session.status === 'abandoned') {
    return shell(
      <EmptyState
        title="This session was ended"
        message="Start a new one from the deck whenever you're ready."
        action={<Button label="Back to deck" variant="secondary" onPress={() => router.back()} />}
      />,
    );
  }

  if (items.length === 0) {
    return shell(
      <EmptyState
        title="Nothing to study"
        message="This session has no cards or questions."
        illustration={<Image source={artwork.flashcardEmpty.source} style={styles.fill} contentFit="contain" />}
      />,
    );
  }

  const allAnswered = score.unanswered === 0;

  return shell(
    <>
      <View style={styles.toolbar}>
        <AppText variant="caption" color="textMuted" style={styles.flex}>
          {mode === 'quiz' ? 'Quiz' : 'Flashcards'} · progress saves as you go
        </AppText>
        <Button label="Save & exit" variant="ghost" compact onPress={() => router.back()} />
        <Button label="End" variant="ghost" compact onPress={() => setConfirmEnd(true)} />
      </View>
      {endError ? <SaveError message={endError} onRetry={endSession} /> : null}

      {mode === 'flashcards' ? (
        <FlashcardPlayer
          items={items.filter((i): i is Extract<SessionItem, { kind: 'flashcard' }> => i.kind === 'flashcard')}
          onAnswer={answer}
          onShuffle={shuffle}
          onAllAnswered={finish}
        />
      ) : (
        <QuizPlayer
          items={items.filter((i): i is Extract<SessionItem, { kind: 'question' }> => i.kind === 'question')}
          onAnswer={answer}
          onAllAnswered={finish}
        />
      )}

      {finishError ? <SaveError message={finishError} onRetry={finish} /> : null}
      {/* Once all quiz questions are answered, the quiz's own feedback card offers "See results". */}
      {!allAnswered || mode === 'flashcards' ? (
        <Button
          label={allAnswered ? 'See results' : 'Finish now'}
          variant={allAnswered ? 'primary' : 'secondary'}
          loading={finishing}
          onPress={finish}
          accessibilityHint={allAnswered ? undefined : `${score.unanswered} unanswered will count as not correct`}
        />
      ) : null}

      <ConfirmDialog
        visible={confirmEnd}
        title="End this session?"
        message="It won't count towards your results. To keep your place instead, use Save & exit."
        confirmLabel="End session"
        destructive
        busy={ending}
        onCancel={() => setConfirmEnd(false)}
        onConfirm={endSession}
      />
    </>,
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
});
