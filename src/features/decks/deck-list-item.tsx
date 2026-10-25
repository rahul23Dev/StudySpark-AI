import { StyleSheet, View } from 'react-native';

import { DeckFolderIcon } from '@/components/illustrations';
import { AppText, Badge, Card } from '@/components/ui';
import type { DeckSummary } from '@/data/types';
import { colors, radii, spacing } from '@/theme';

import { cardCountLabel, shortDate } from './format';

export function DeckListItem({ deck, onPress }: { deck: DeckSummary; onPress: () => void }) {
  const meta = `${cardCountLabel(deck.cardCount)} · Updated ${shortDate(deck.updatedAt)}`;
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${deck.title}${deck.subject ? `, ${deck.subject}` : ''}. ${meta}`}
      accessibilityHint="Opens the deck"
      style={styles.card}>
      <View style={styles.icon} aria-hidden>
        <DeckFolderIcon width={30} height={30} />
      </View>
      <View style={styles.body}>
        <AppText variant="label" numberOfLines={2}>
          {deck.title}
        </AppText>
        {deck.subject ? <Badge label={deck.subject} tone="primary" /> : null}
        <AppText variant="caption" color="textMuted">
          {meta}
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: spacing.xs },
});
