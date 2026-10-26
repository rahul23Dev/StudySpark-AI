import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { artwork } from '@/components/artwork';
import { AddCardIcon, QuizIcon } from '@/components/illustrations';
import {
  AppText,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  ScreenContainer,
  SectionTitle,
} from '@/components/ui';
import { useRepository } from '@/data/database-context';
import { useFocusQuery } from '@/data/use-query';
import { FlashcardItem } from '@/features/decks/flashcard-item';
import { QuestionItem } from '@/features/decks/question-item';
import { ReviewPanel } from '@/features/study/review-panel';
import { StudyPanel } from '@/features/study/study-panel';
import { cardCountLabel, shortDate } from '@/features/decks/format';
import { spacing } from '@/theme';

type Banner = 'created' | 'duplicated' | null;

export default function DeckDetailScreen() {
  const params = useLocalSearchParams<{ id: string; created?: string; duplicated?: string }>();
  const id = params.id;
  const router = useRouter();
  const repo = useRepository();

  const load = useCallback(async () => {
    const [deck, cards, questions, flash, quiz, dueCards] = await Promise.all([
      repo.getDeck(id),
      repo.listFlashcards(id),
      repo.listQuizQuestions(id),
      repo.getActiveSession(id, 'flashcards'),
      repo.getActiveSession(id, 'quiz'),
      repo.listDueCards({ now: new Date(), deckId: id }),
    ]);
    if (!deck) return null;
    const summary = async (s: typeof flash) =>
      s ? { id: s.id, score: (await repo.getSessionDetail(s.id)).score } : null;
    const newCards = dueCards.filter((c) => c.dueAt === null).length;
    const review = { due: dueCards.length - newCards, newCards, scheduled: cards.length - newCards };
    return { deck, cards, questions, review, activeFlashcards: await summary(flash), activeQuiz: await summary(quiz) };
  }, [repo, id]);
  const query = useFocusQuery(load);

  const [banner, setBanner] = useState<Banner>(
    params.created === '1' ? 'created' : params.duplicated === '1' ? 'duplicated' : null,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetCount, setResetCount] = useState<number | null>(null);
  const [busy, setBusy] = useState<'delete' | 'duplicate' | 'move' | 'study' | 'reset' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function act(kind: 'delete' | 'duplicate' | 'move' | 'study' | 'reset', task: () => Promise<void>, failure: string) {
    setBusy(kind);
    setActionError(null);
    try {
      await task();
    } catch {
      setActionError(failure);
    } finally {
      setBusy(null);
    }
  }

  const container = (children: React.ReactNode, title = 'Deck') => (
    <ScreenContainer edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title }} />
      {children}
    </ScreenContainer>
  );

  if (!query.data) {
    if (query.status === 'loading') return container(<LoadingState message="Loading deck…" />);
    return container(
      query.status === 'error' ? (
        <ErrorState message="We couldn't load this deck." onRetry={query.reload} />
      ) : (
        <EmptyState
          title="Deck not found"
          message="It may have been deleted."
          action={<Button label="Back to My Decks" variant="secondary" onPress={() => router.navigate('/decks')} />}
        />
      ),
    );
  }

  const { deck, cards, questions, review, activeFlashcards, activeQuiz } = query.data;

  return container(
    <>
      {banner ? (
        <Card tone="primary" style={styles.banner} accessibilityLiveRegion="polite">
          <View style={styles.bannerArt} aria-hidden>
            <Image source={artwork.deckSuccess.source} style={styles.fill} contentFit="contain" />
          </View>
          <View style={styles.bannerText}>
            <AppText variant="label">{banner === 'created' ? 'Deck created!' : 'Copy created!'}</AppText>
            <AppText variant="caption" color="textMuted">
              {banner === 'created'
                ? 'Add your first cards below.'
                : 'This is a separate copy. Changes here won’t affect the original.'}
            </AppText>
            <Button label="Got it" variant="ghost" compact onPress={() => setBanner(null)} />
          </View>
        </Card>
      ) : null}

      <Card style={styles.summary}>
        <AppText variant="title" accessibilityRole="header">
          {deck.title}
        </AppText>
        {deck.subject ? <Badge label={deck.subject} tone="primary" /> : null}
        {deck.description ? (
          <AppText variant="body" color="textMuted">
            {deck.description}
          </AppText>
        ) : null}
        <AppText variant="caption" color="textMuted">
          {cardCountLabel(cards.length)} · Created {shortDate(deck.createdAt)} · Updated {shortDate(deck.updatedAt)}
        </AppText>
        <View style={styles.actions}>
          <Button label="Edit" variant="secondary" compact onPress={() => router.push(`/deck/${id}/edit`)} />
          <Button
            label="Duplicate"
            variant="secondary"
            compact
            loading={busy === 'duplicate'}
            disabled={busy !== null}
            onPress={() =>
              act(
                'duplicate',
                async () => {
                  const copy = await repo.duplicateDeck(id);
                  router.push({ pathname: '/deck/[id]', params: { id: copy.id, duplicated: '1' } });
                },
                "Couldn't duplicate the deck. Please try again.",
              )
            }
          />
          <Button
            label="Delete"
            variant="ghost"
            compact
            disabled={busy !== null}
            onPress={() => setConfirmDelete(true)}
          />
        </View>
        {actionError ? (
          <AppText variant="caption" color="danger" accessibilityRole="alert">
            {actionError}
          </AppText>
        ) : null}
      </Card>

      <SectionTitle>Study</SectionTitle>
      <StudyPanel
        cardCount={cards.length}
        questionCount={questions.length}
        activeFlashcards={activeFlashcards}
        activeQuiz={activeQuiz}
        busy={busy !== null}
        onResume={(sessionId) => router.push(`/session/${sessionId}`)}
        onStart={(mode) =>
          act(
            'study',
            async () => {
              const session = await repo.startSession(id, mode);
              router.push(`/session/${session.id}`);
            },
            "Couldn't start the session. Please try again.",
          )
        }
      />

      <ReviewPanel
        counts={review}
        busy={busy !== null}
        onReview={() =>
          act(
            'study',
            async () => {
              const session = await repo.startSession(id, 'flashcards', { dueOnly: true });
              router.push(`/session/${session.id}`);
            },
            "Couldn't start the review. Please try again.",
          )
        }
        onReset={() => {
          setResetCount(null);
          setConfirmReset(true);
        }}
      />
      {resetCount !== null ? (
        <AppText variant="caption" color="textMuted" accessibilityLiveRegion="polite">
          {`Schedule reset. ${cardCountLabel(resetCount)} ${resetCount === 1 ? 'is' : 'are'} new again.`}
        </AppText>
      ) : null}

      <View style={styles.cardsHeader}>
        <SectionTitle>{`Cards (${cards.length})`}</SectionTitle>
        <Button
          label="Add card"
          compact
          icon={<AddCardIcon width={20} height={20} />}
          onPress={() => router.push(`/deck/${id}/card/new`)}
        />
      </View>

      {cards.length === 0 ? (
        <EmptyState
          title="No cards yet"
          message="Add a question on the front and the answer on the back."
          illustration={<Image source={artwork.flashcardEmpty.source} style={styles.fill} contentFit="contain" />}
        />
      ) : (
        <View style={styles.list}>
          {cards.map((card, index) => (
            <FlashcardItem
              key={card.id}
              card={card}
              index={index}
              total={cards.length}
              busy={busy !== null}
              onEdit={() => router.push(`/deck/${id}/card/${card.id}`)}
              onMove={(direction) =>
                act(
                  'move',
                  async () => {
                    await repo.moveFlashcard(card.id, direction);
                    query.reload();
                  },
                  "Couldn't move the card. Please try again.",
                )
              }
            />
          ))}
        </View>
      )}

      <View style={styles.cardsHeader}>
        <SectionTitle>{`Quiz questions (${questions.length})`}</SectionTitle>
        <Button
          label="Add question"
          compact
          icon={<QuizIcon width={20} height={20} />}
          onPress={() => router.push(`/deck/${id}/question/new`)}
        />
      </View>
      {questions.length === 0 ? (
        <AppText variant="body" color="textMuted">
          Add multiple-choice or true/false questions to quiz yourself on this deck.
        </AppText>
      ) : (
        <View style={styles.list}>
          {questions.map((question, index) => (
            <QuestionItem
              key={question.id}
              question={question}
              index={index}
              onEdit={() => router.push(`/deck/${id}/question/${question.id}`)}
            />
          ))}
        </View>
      )}

      <ConfirmDialog
        visible={confirmReset}
        title="Reset review schedule?"
        message="Every card in this deck becomes new and due now. Your past answers and progress stay."
        confirmLabel="Reset schedule"
        busy={busy === 'reset'}
        onCancel={() => setConfirmReset(false)}
        onConfirm={() =>
          act(
            'reset',
            async () => {
              setResetCount(await repo.resetDeckSchedule(id));
              await query.reload();
            },
            "Couldn't reset the schedule. Please try again.",
          ).then(() => setConfirmReset(false))
        }
      />

      <ConfirmDialog
        visible={confirmDelete}
        title={`Delete “${deck.title}”?`}
        message={`This deletes the deck and its ${cardCountLabel(cards.length)}. This can't be undone.`}
        confirmLabel="Delete deck"
        destructive
        busy={busy === 'delete'}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          act(
            'delete',
            async () => {
              await repo.deleteDeck(id);
              setConfirmDelete(false);
              if (router.canGoBack()) router.back();
              else router.replace('/decks');
            },
            "Couldn't delete the deck. Please try again.",
          ).then(() => setConfirmDelete(false))
        }
      />
    </>,
    deck.title,
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bannerArt: { width: 96, aspectRatio: artwork.deckSuccess.aspectRatio },
  bannerText: { flex: 1, gap: spacing.xs, alignItems: 'flex-start' },
  fill: { width: '100%', height: '100%' },
  summary: { gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  cardsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  list: { gap: spacing.md },
});
