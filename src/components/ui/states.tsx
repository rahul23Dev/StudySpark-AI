import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors, radii, spacing } from '@/theme';

import { AppText } from './app-text';
import { Button } from './button';

export function LoadingState({ message = 'Loading…' }: { message?: string }) {
  return (
    <View style={styles.centered} accessibilityRole="progressbar" accessibilityLabel={message} accessible>
      <ActivityIndicator size="large" color={colors.primaryText} />
      <AppText variant="body" color="textMuted" style={styles.center}>
        {message}
      </AppText>
    </View>
  );
}

export type EmptyStateProps = {
  title: string;
  message: string;
  /** Decorative artwork; it is hidden from screen readers. */
  illustration?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ title, message, illustration, action }: EmptyStateProps) {
  return (
    <View style={styles.centered}>
      {illustration ? (
        <View style={styles.art} aria-hidden>
          {illustration}
        </View>
      ) : null}
      <AppText variant="heading" style={styles.center} accessibilityRole="header">
        {title}
      </AppText>
      <AppText variant="body" color="textMuted" style={styles.center}>
        {message}
      </AppText>
      {action}
    </View>
  );
}

export type ErrorStateProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
};

export function ErrorState({ title = 'Something went wrong', message, onRetry, retryLabel = 'Try again' }: ErrorStateProps) {
  return (
    <View style={styles.centered} accessibilityRole="alert">
      <View style={styles.errorBadge} aria-hidden>
        <AppText variant="title" color="danger">
          !
        </AppText>
      </View>
      <AppText variant="heading" style={styles.center}>
        {title}
      </AppText>
      <AppText variant="body" color="textMuted" style={styles.center}>
        {message}
      </AppText>
      {onRetry ? <Button label={retryLabel} variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  center: { textAlign: 'center', maxWidth: 360 },
  art: { width: '80%', maxWidth: 280, aspectRatio: 4 / 3 },
  errorBadge: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
