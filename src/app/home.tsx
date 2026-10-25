import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { artwork } from '@/components/artwork';
import { EmptyState } from '@/components/empty-state';
import { FeatureCard } from '@/components/feature-card';
import { SparkIcon } from '@/components/illustrations';
import { AppText, Screen } from '@/components/ui';
import { STUDY_FEATURES, type StudyFeatureId } from '@/features/catalog';
import { spacing } from '@/theme';

const FEATURE_ART: Record<StudyFeatureId, number> = {
  flashcards: artwork.flashcards,
  quizzes: artwork.quizzes,
  progress: artwork.progress,
};

export default function HomeScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.eyebrow}>
          <View aria-hidden>
            <SparkIcon width={18} height={18} />
          </View>
          <AppText variant="caption" color="primary">
            YOUR STUDY SPACE
          </AppText>
        </View>
        <AppText variant="title" accessibilityRole="header">
          Ready when you are
        </AppText>
      </View>

      <View style={styles.section}>
        <AppText variant="heading" accessibilityRole="header">
          Study tools
        </AppText>
        {STUDY_FEATURES.map((feature) => (
          <FeatureCard
            key={feature.id}
            feature={feature}
            illustration={<Image source={FEATURE_ART[feature.id]} style={styles.fill} contentFit="cover" />}
          />
        ))}
      </View>

      <EmptyState
        title="No study sets yet"
        message="Creating study sets arrives in an upcoming update. Your sets will appear here."
        illustration={<Image source={artwork.emptyState.source} style={styles.fill} contentFit="contain" />}
        aspectRatio={artwork.emptyState.aspectRatio}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  section: { gap: spacing.md },
  fill: { width: '100%', height: '100%' },
});
