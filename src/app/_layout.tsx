import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErrorState, LoadingState } from '@/components/ui';
import { DatabaseProvider, useDatabase } from '@/data/database-context';
import { openStudyRepository } from '@/data/open-database';
import { SettingsProvider } from '@/settings/settings-context';
import { colors, lightTheme } from '@/theme';
import { lightNavigationTheme } from '@/theme/navigation-theme';

/** Holds the app until the local database is open and migrated. */
function DatabaseGate({ children }: { children: ReactNode }) {
  const db = useDatabase();
  if (db.status === 'ready') return children;
  return (
    <View style={styles.fill}>
      {db.status === 'loading' ? (
        <LoadingState message="Opening your study library…" />
      ) : (
        <ErrorState
          title="Couldn't open your study library"
          message="Your decks are stored on this device. Please try again."
          onRetry={db.retry}
        />
      )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <SettingsProvider>
      <DatabaseProvider open={openStudyRepository}>
        <ThemeProvider value={lightNavigationTheme}>
          <StatusBar style={lightTheme.statusBarStyle} />
          <DatabaseGate>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
                headerShadowVisible: false,
                headerTintColor: colors.text,
                headerStyle: { backgroundColor: colors.background },
                headerBackButtonDisplayMode: 'minimal',
              }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
              <Stack.Screen name="settings" options={{ headerShown: true, title: 'Settings' }} />
              <Stack.Screen name="deck/new" options={{ headerShown: true, title: 'New deck', presentation: 'modal' }} />
              <Stack.Screen name="deck/[id]/index" options={{ headerShown: true, title: 'Deck' }} />
              <Stack.Screen name="deck/[id]/edit" options={{ headerShown: true, title: 'Edit deck', presentation: 'modal' }} />
              <Stack.Screen name="deck/[id]/card/new" options={{ headerShown: true, title: 'New card' }} />
              <Stack.Screen name="deck/[id]/card/[cardId]" options={{ headerShown: true, title: 'Edit card' }} />
              <Stack.Screen name="deck/[id]/question/new" options={{ headerShown: true, title: 'New question' }} />
              <Stack.Screen
                name="deck/[id]/question/[questionId]"
                options={{ headerShown: true, title: 'Edit question' }}
              />
              <Stack.Screen name="session/[id]/index" options={{ headerShown: true, title: 'Study' }} />
              <Stack.Screen
                name="session/[id]/results"
                options={{ headerShown: true, title: 'Results', headerBackVisible: false, gestureEnabled: false }}
              />
            </Stack>
          </DatabaseGate>
        </ThemeProvider>
      </DatabaseProvider>
    </SettingsProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
});
