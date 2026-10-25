import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { SettingsIcon, SparkleIcon } from '@/components/icons';
import { AppText, Card, ListRow, PageHeader, ScreenContainer, SectionTitle } from '@/components/ui';
import { initialsOf, useDisplayName } from '@/settings/display-name';
import { colors, radii, spacing } from '@/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const name = useDisplayName();
  const version = Constants.expoConfig?.version ?? 'unknown';

  return (
    <ScreenContainer>
      <PageHeader title="Profile" />

      <Card style={styles.identity}>
        <View style={styles.avatar} aria-hidden>
          <AppText variant="title" color="primaryText">
            {initialsOf(name)}
          </AppText>
        </View>
        <View style={styles.identityText}>
          <AppText variant="heading">{name}</AppText>
          <AppText variant="caption" color="textMuted">
            StudySpark learner
          </AppText>
        </View>
      </Card>

      <SectionTitle>Account</SectionTitle>
      <Card style={styles.list}>
        <ListRow
          title="Settings"
          subtitle="Display name and appearance"
          leading={<SettingsIcon color={colors.primaryText} />}
          onPress={() => router.push('/settings')}
        />
        <View style={styles.divider} />
        <ListRow
          title="Replay introduction"
          subtitle="See the welcome screen again"
          leading={<SparkleIcon color={colors.accent} />}
          onPress={() => router.push('/onboarding')}
        />
      </Card>

      <SectionTitle>About</SectionTitle>
      <Card style={styles.list}>
        <ListRow title="App version" subtitle={version} />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  identityText: { flex: 1, gap: spacing.xxs },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { padding: 0, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },
});
