import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { artwork } from '@/components/artwork';
import { FeatureCard } from '@/components/feature-card';
import { ArrowRightIcon, SparkleIcon } from '@/components/icons';
import { Logo } from '@/components/illustrations';
import { AppText, Button, Card, ScreenContainer, SectionTitle, StatTile } from '@/components/ui';
import { useRepository } from '@/data/database-context';
import { useFocusQuery } from '@/data/use-query';
import { STUDY_FEATURES, type StudyFeatureId } from '@/features/catalog';
import { GoalMeter } from '@/features/progress/goal-meter';
import { initialsOf, useDisplayName } from '@/settings/display-name';
import { useSettings } from '@/settings/settings-context';
import { computeProgress } from '@/study/progress';
import { colors, MIN_TOUCH_TARGET, radii, spacing } from '@/theme';

const FEATURE_ROUTE = { flashcards: '/decks', quizzes: '/decks', progress: '/progress' } as const;

const FEATURE_ART: Record<StudyFeatureId, number> = {
  flashcards: artwork.flashcards,
  quizzes: artwork.quizzes,
  progress: artwork.progress,
};

export default function HomeScreen() {
  const router = useRouter();
  const name = useDisplayName();
  const repo = useRepository();
  const { settings } = useSettings();
  const dailyGoal = settings.dailyGoal;
  const load = useCallback(() => repo.getStats(), [repo]);
  const stats = useFocusQuery(load);
  const loadToday = useCallback(async () => {
    const now = new Date();
    const [attempts, due] = await Promise.all([repo.listActivity(), repo.listDueByDeck(now)]);
    const { goal } = computeProgress({ attempts, sessionsCompleted: 0, dailyGoal, now });
    return { goal, dueCards: due.reduce((n, d) => n + d.due + d.newCards, 0) };
  }, [repo, dailyGoal]);
  const today = useFocusQuery(loadToday);
  const hasDecks = (stats.data?.deckCount ?? 0) > 0;
  const statValue = (n: number | undefined) => (n === undefined ? '–' : n);

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View aria-hidden>
          <Logo width={44} height={44} />
        </View>
        <View style={styles.greeting}>
          <AppText variant="heading" accessibilityRole="header">
            Hello, {name}
          </AppText>
          <AppText variant="caption" color="textMuted">
            Learn smarter. Remember longer.
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open your profile"
          onPress={() => router.navigate('/profile')}
          style={({ pressed }) => [styles.avatar, pressed && styles.avatarPressed]}>
          <AppText variant="label" color="primaryText">
            {initialsOf(name)}
          </AppText>
        </Pressable>
      </View>

      <Card tone="navy" style={styles.hero}>
        <View style={styles.heroSparkles} aria-hidden>
          <SparkleIcon color={colors.amber} size={28} />
          <SparkleIcon color={colors.accent} size={16} />
        </View>
        <AppText variant="caption" color="amber">
          {hasDecks ? 'YOUR LIBRARY' : 'GET STARTED'}
        </AppText>
        <AppText variant="title" color="textInverse">
          {hasDecks ? 'Keep your decks\ngrowing' : 'Build your first\nstudy deck'}
        </AppText>
        <AppText variant="body" color="textInverseMuted">
          {hasDecks
            ? 'Add cards, tidy up and organise your decks in My Decks.'
            : 'Decks hold your flashcards. Create one in My Decks.'}
        </AppText>
        <View style={styles.heroAction}>
          <Button
            label="Open My Decks"
            icon={<ArrowRightIcon color={colors.textOnPrimary} size={20} />}
            onPress={() => router.navigate('/decks')}
          />
        </View>
      </Card>

      <View style={styles.stats}>
        <StatTile label="Decks" value={statValue(stats.data?.deckCount)} tone="accent" />
        <StatTile label="Flashcards" value={statValue(stats.data?.cardCount)} tone="primary" />
      </View>

      {today.data && hasDecks ? (
        <Card style={styles.today}>
          <SectionTitle>Today</SectionTitle>
          <GoalMeter goal={today.data.goal} />
          <AppText variant="caption" color="textMuted">
            {today.data.dueCards === 0
              ? 'No cards are due for review.'
              : `${today.data.dueCards} ${today.data.dueCards === 1 ? 'card is' : 'cards are'} ready to review.`}
          </AppText>
          <Button label="See progress" variant="secondary" compact onPress={() => router.navigate('/progress')} />
        </Card>
      ) : null}

      <View style={styles.section}>
        <SectionTitle>{STUDY_FEATURES.some((f) => f.status === 'planned') ? 'Coming soon' : 'Study tools'}</SectionTitle>
        {STUDY_FEATURES.map((feature) => (
          <FeatureCard
            key={feature.id}
            feature={feature}
            onPress={() => router.navigate(FEATURE_ROUTE[feature.id])}
            illustration={<Image source={FEATURE_ART[feature.id]} style={styles.fill} contentFit="cover" />}
          />
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  greeting: { flex: 1, gap: spacing.xxs },
  avatar: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPressed: { backgroundColor: colors.primary },
  hero: { gap: spacing.sm, padding: spacing.xl, overflow: 'hidden' },
  heroSparkles: { position: 'absolute', top: spacing.lg, right: spacing.lg, alignItems: 'flex-end', gap: spacing.xs },
  heroAction: { alignSelf: 'flex-start', marginTop: spacing.sm },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  today: { gap: spacing.md, alignItems: 'stretch' },
  section: { gap: spacing.md },
  fill: { width: '100%', height: '100%' },
});
