import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { artwork } from '@/components/artwork';
import { ArrowRightIcon } from '@/components/illustrations';
import { AppText, Button, Screen } from '@/components/ui';
import { colors, radii, shadows, spacing } from '@/theme';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.brand}>
        <Image source={artwork.logoMark} style={styles.logo} aria-hidden />
        <AppText variant="heading" accessibilityRole="header">
          StudySpark AI
        </AppText>
      </View>

      <View style={styles.artCard} aria-hidden>
        <Image source={artwork.onboarding.source} style={styles.art} contentFit="contain" />
      </View>

      <View style={styles.copy}>
        <AppText variant="display">Learn Smarter.{'\n'}Remember Longer.</AppText>
        <AppText variant="body" color="textMuted">
          A calm study space for flashcards, quizzes and tracking your progress. We are building it step by step.
        </AppText>
      </View>

      <Button
        label="Get started"
        accessibilityHint="Opens your study space"
        icon={<ArrowRightIcon width={20} height={20} />}
        onPress={() => router.push('/home')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logo: { width: 40, height: 40 },
  artCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    ...shadows.card,
  },
  // The source crop is ~156px wide, so cap the size to keep it reasonably sharp.
  art: { width: '100%', maxWidth: 280, aspectRatio: artwork.onboarding.aspectRatio },
  copy: { gap: spacing.md },
});
