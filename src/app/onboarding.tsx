import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { artwork } from '@/components/artwork';
import { ArrowRightIcon } from '@/components/icons';
import { Logo } from '@/components/illustrations';
import { AppText, Button, ScreenContainer } from '@/components/ui';
import { useSettings } from '@/settings/settings-context';
import { colors, radii, shadows, spacing } from '@/theme';

export default function OnboardingScreen() {
  const router = useRouter();
  const { completeOnboarding } = useSettings();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function getStarted() {
    setSaving(true);
    setError(null);
    try {
      await completeOnboarding();
      // Opened from Profile ("Replay introduction"): go back. First launch: enter the tabs.
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch {
      setError("Couldn't save your progress. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenContainer contentStyle={styles.content} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.brand}>
        <View aria-hidden>
          <Logo width={44} height={44} />
        </View>
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
          Your calm study space for flashcard decks, quick quizzes and progress tracking. We are building it step by
          step.
        </AppText>
      </View>

      <View style={styles.actions}>
        <Button
          label="Get started"
          accessibilityHint="Opens your study space"
          icon={<ArrowRightIcon color={colors.textOnPrimary} size={20} />}
          loading={saving}
          onPress={getStarted}
        />
        {error ? (
          <AppText variant="caption" color="danger" accessibilityRole="alert">
            {error}
          </AppText>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  artCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.md,
    ...shadows.card,
  },
  // Source is 450x450; keep it at or below its natural size on most phones.
  art: { width: '100%', maxWidth: 260, aspectRatio: artwork.onboarding.aspectRatio },
  copy: { gap: spacing.md },
  actions: { gap: spacing.sm },
});
