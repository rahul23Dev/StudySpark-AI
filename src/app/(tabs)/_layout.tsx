import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/tabs';
import { StyleSheet, View } from 'react-native';

import { DecksIcon, HomeIcon, ProfileIcon, ProgressIcon } from '@/components/icons';
import { FloatingTabBar } from '@/components/tab-bar';
import { ErrorState, LoadingState } from '@/components/ui';
import { useSettings } from '@/settings/settings-context';
import { colors } from '@/theme';

export default function TabsLayout() {
  const { status, settings, reload } = useSettings();

  if (status === 'loading') {
    return (
      <View style={styles.fill}>
        <LoadingState message="Getting your study space ready…" />
      </View>
    );
  }
  if (status === 'error') {
    return (
      <View style={styles.fill}>
        <ErrorState message="We couldn't load your saved settings." onRetry={reload} />
      </View>
    );
  }
  if (!settings.hasSeenOnboarding) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color, size }) => <HomeIcon color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="decks"
        options={{ title: 'My Decks', tabBarIcon: ({ color, size }) => <DecksIcon color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="progress"
        options={{ title: 'Progress', tabBarIcon: ({ color, size }) => <ProgressIcon color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <ProfileIcon color={color} size={size} /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
});
