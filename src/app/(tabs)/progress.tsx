import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { artwork } from '@/components/artwork';
import { ProgressChartIcon, ReviewCalendarIcon, StreakIcon } from '@/components/illustrations';
import {
  AppText,
  Badge,
  Button,
  Card,
  ErrorState,
  ListRow,
  LoadingState,
  PageHeader,
  ScreenContainer,
  SectionTitle,
  StatTile,
} from '@/components/ui';
import { useRepository } from '@/data/database-context';
import { useFocusQuery } from '@/data/use-query';
import { GoalMeter } from '@/features/progress/goal-meter';
import { WeeklyChart } from '@/features/progress/weekly-chart';
import { useSettings } from '@/settings/settings-context';
import { computeProgress } from '@/study/progress';
import { spacing } from '@/theme';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function ProgressScreen() {
  const repo = useRepository();
  const router = useRouter();
  const { settings } = useSettings();
  const dailyGoal = settings.dailyGoal;

  // Everything here is computed from answers and sessions saved on this device.
  const load = useCallback(async () => {
    const now = new Date();
    const [attempts, sessions, due] = await Promise.all([
      repo.listActivity(),
      repo.listCompletedSessions(),
      repo.listDueByDeck(now),
    ]);
    return { progress: computeProgress({ attempts, sessionsCompleted: sessions.length, dailyGoal, now }), due };
  }, [repo, dailyGoal]);
  const query = useFocusQuery(load);

  const [starting, setStarting] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  async function reviewDeck(deckId: string) {
    setStarting(deckId);
    setStartError(null);
    try {
      const session = await repo.startSession(deckId, 'flashcards', { dueOnly: true });
      router.push(`/session/${session.id}`);
    } catch {
      setStartError("Couldn't start the review. Please try again.");
      query.reload();
    } finally {
      setStarting(null);
    }
  }

  const header = <PageHeader title="Progress" subtitle="See how your studying adds up." />;

  if (!query.data) {
    return (
      <ScreenContainer>
        {header}
        {query.status === 'error' ? (
          <ErrorState message="We couldn't load your progress." onRetry={query.reload} />
        ) : (
          <LoadingState message="Adding up your progress…" />
        )}
      </ScreenContainer>
    );
  }

  const { progress, due } = query.data;
  const { goal, totals, quizAccuracy, weakTopics } = progress;

  return (
    <ScreenContainer>
      {header}

      {progress.hasActivity ? null : (
        <Card tone="primary" style={styles.intro}>
          <View style={styles.introArt} aria-hidden>
            <Image source={artwork.progressGrowth.source} style={styles.fill} contentFit="contain" />
          </View>
          <AppText variant="heading" style={styles.center}>
            No study activity yet
          </AppText>
          <AppText variant="body" color="textMuted" style={styles.center}>
            Review some flashcards or take a quiz. Your goal, streak and charts fill in from your real answers.
          </AppText>
        </Card>
      )}

      <Card style={styles.today}>
        <View style={styles.titleRow}>
          <SectionTitle>Today</SectionTitle>
          {goal.met ? <Badge label="Goal met" tone="primary" /> : null}
        </View>
        <GoalMeter goal={goal} />
        {progress.quizAnswersToday > 0 ? (
          <AppText variant="caption" color="textMuted">
            Plus {plural(progress.quizAnswersToday, 'quiz answer')} today.
          </AppText>
        ) : null}
        <Button label="Change daily goal" variant="ghost" compact onPress={() => router.push('/settings')} />
      </Card>

      <Card tone="amber" style={styles.streak} accessible accessibilityLabel={`Study streak: ${plural(progress.streakDays, 'day')}`}>
        <View aria-hidden>
          <StreakIcon width={40} height={40} />
        </View>
        <View style={styles.streakText}>
          <AppText variant="stat">{plural(progress.streakDays, 'day')}</AppText>
          <AppText variant="caption" color="textMuted">
            {progress.streakDays === 0
              ? 'Study today to start a streak.'
              : 'Days in a row with at least one answer.'}
          </AppText>
        </View>
      </Card>

      <View style={styles.tiles}>
        <StatTile label="Cards reviewed" value={totals.cardsReviewed} tone="primary" />
        <StatTile label="Sessions completed" value={totals.sessionsCompleted} tone="accent" />
      </View>

      <Card style={styles.section}>
        <SectionTitle>Quiz accuracy</SectionTitle>
        {quizAccuracy.percent === null ? (
          <AppText variant="body" color="textMuted">
            No quiz answers yet. Take a quiz to see your accuracy.
          </AppText>
        ) : (
          <>
            <AppText variant="stat" accessibilityLabel={`Quiz accuracy ${quizAccuracy.percent} percent`}>
              {quizAccuracy.percent}%
            </AppText>
            <AppText variant="caption" color="textMuted">
              {quizAccuracy.correct} correct out of {plural(quizAccuracy.answered, 'answered question')}, all time.
              Skipped questions are not counted.
            </AppText>
          </>
        )}
      </Card>

      <Card style={styles.section}>
        <View style={styles.titleRow}>
          <View aria-hidden>
            <ProgressChartIcon width={22} height={22} />
          </View>
          <SectionTitle>This week</SectionTitle>
        </View>
        <WeeklyChart week={progress.week} today={progress.today} />
      </Card>

      <View style={styles.titleRow}>
        <View aria-hidden>
          <ReviewCalendarIcon width={22} height={22} />
        </View>
        <SectionTitle>Due for review</SectionTitle>
      </View>
      {due.length === 0 ? (
        <Card style={styles.caughtUp}>
          <View style={styles.smallArt} aria-hidden>
            <Image source={artwork.revisionCalendar.source} style={styles.fill} contentFit="contain" />
          </View>
          <AppText variant="body" color="textMuted" style={styles.flex}>
            Nothing is due right now. Cards come back here when it&apos;s time to review them.
          </AppText>
        </Card>
      ) : (
        <View style={styles.list}>
          {due.map((d) => (
            <ListRow
              key={d.deckId}
              title={d.deckTitle}
              subtitle={[d.due > 0 ? `${d.due} due` : null, d.newCards > 0 ? `${d.newCards} new` : null]
                .filter(Boolean)
                .join(' · ')}
              trailing={
                <Button
                  label="Review"
                  accessibilityHint={`Reviews the due and new cards in ${d.deckTitle}`}
                  compact
                  loading={starting === d.deckId}
                  disabled={starting !== null}
                  onPress={() => reviewDeck(d.deckId)}
                />
              }
            />
          ))}
        </View>
      )}
      {startError ? (
        <AppText variant="caption" color="danger" accessibilityRole="alert">
          {startError}
        </AppText>
      ) : null}

      <SectionTitle>Topics to revisit</SectionTitle>
      {weakTopics.length === 0 ? (
        <AppText variant="body" color="textMuted">
          {progress.hasActivity
            ? 'No weak topics in the last 30 days. Decks show up here once you get some answers wrong.'
            : 'Decks you find tricky will show up here.'}
        </AppText>
      ) : (
        <View style={styles.list}>
          {weakTopics.map((t) => (
            <ListRow
              key={t.deckId}
              title={t.title}
              subtitle={`Missed ${t.incorrect} of ${plural(t.answers, 'answer')} (${t.missRate}%) in the last 30 days`}
              onPress={() => router.push(`/deck/${t.deckId}`)}
              accessibilityHint="Opens the deck"
            />
          ))}
        </View>
      )}

      {goal.met && progress.streakDays > 1 ? (
        <View style={styles.celebrate} aria-hidden>
          <Image source={artwork.streakCelebration.source} style={styles.fill} contentFit="contain" />
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  intro: { alignItems: 'center', gap: spacing.sm },
  introArt: { width: '70%', maxWidth: 240, aspectRatio: artwork.progressGrowth.aspectRatio },
  center: { textAlign: 'center' },
  fill: { width: '100%', height: '100%' },
  today: { gap: spacing.md, alignItems: 'stretch' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'flex-start' },
  streak: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  streakText: { flex: 1, gap: spacing.xxs },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  section: { gap: spacing.sm },
  caughtUp: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  smallArt: { width: 88, aspectRatio: artwork.revisionCalendar.aspectRatio },
  flex: { flex: 1 },
  list: { gap: spacing.md },
  celebrate: { alignSelf: 'center', width: '60%', maxWidth: 220, aspectRatio: artwork.streakCelebration.aspectRatio },
});
