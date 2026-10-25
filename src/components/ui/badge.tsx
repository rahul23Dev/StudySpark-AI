import { StyleSheet, View } from 'react-native';

import { colors, radii, spacing } from '@/theme';

import { AppText } from './app-text';

export type BadgeProps = {
  label: string;
  tone?: 'accent' | 'primary';
};

export function Badge({ label, tone = 'accent' }: BadgeProps) {
  const accent = tone === 'accent';
  return (
    <View style={[styles.badge, { backgroundColor: accent ? colors.accentSoft : colors.primarySoft }]}>
      <AppText variant="caption" color={accent ? 'accentText' : 'primary'}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.pill,
  },
});
