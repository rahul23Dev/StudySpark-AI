import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { artwork } from '@/components/artwork';
import { AddCardIcon } from '@/components/illustrations';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  ScreenContainer,
  SegmentedControl,
} from '@/components/ui';
import { useRepository } from '@/data/database-context';
import type { DeckSort } from '@/data/types';
import { useFocusQuery } from '@/data/use-query';
import { DeckListItem } from '@/features/decks/deck-list-item';
import { DECK_SORT_OPTIONS } from '@/features/decks/format';
import { spacing } from '@/theme';

export default function DecksScreen() {
  const router = useRouter();
  const repo = useRepository();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<DeckSort>('updated');

  const load = useCallback(
    async () => ({ decks: await repo.listDecks({ search, sort }), total: (await repo.getStats()).deckCount }),
    [repo, search, sort],
  );
  const query = useFocusQuery(load);
  const newDeck = () => router.push('/deck/new');

  const header = (
    <PageHeader
      title="My Decks"
      subtitle={query.data ? `${query.data.total} ${query.data.total === 1 ? 'deck' : 'decks'}` : 'Your flashcard decks'}
      trailing={<Button label="New deck" compact onPress={newDeck} icon={<AddCardIcon width={20} height={20} />} />}
    />
  );

  if (!query.data) {
    return (
      <ScreenContainer>
        {header}
        {query.status === 'error' ? (
          <ErrorState message="We couldn't load your decks." onRetry={query.reload} />
        ) : (
          <LoadingState message="Loading your decks…" />
        )}
      </ScreenContainer>
    );
  }

  const { decks, total } = query.data;

  if (total === 0) {
    return (
      <ScreenContainer>
        {header}
        <Card style={styles.grow}>
          <EmptyState
            title="No decks yet"
            message="Create a deck, then add flashcards to start studying."
            illustration={<Image source={artwork.emptyDecks.source} style={styles.fill} contentFit="contain" />}
            action={<Button label="Create your first deck" onPress={newDeck} />}
          />
        </Card>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {header}
      <View style={styles.controls}>
        <Input
          label="Search decks"
          value={search}
          onChangeText={setSearch}
          placeholder="Title, subject or description"
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        <SegmentedControl accessibilityLabel="Sort decks" options={DECK_SORT_OPTIONS} value={sort} onChange={setSort} />
      </View>

      {query.status === 'error' ? (
        <AppText variant="caption" color="danger" accessibilityRole="alert">
          {"Couldn't refresh the list. "}
          <AppText variant="caption" color="primaryText" onPress={query.reload} accessibilityRole="button">
            Try again
          </AppText>
        </AppText>
      ) : null}

      {decks.length === 0 ? (
        <EmptyState
          title="No matching decks"
          message={`Nothing matches "${search.trim()}". Try another word.`}
          action={<Button label="Clear search" variant="secondary" onPress={() => setSearch('')} />}
        />
      ) : (
        <View style={styles.list} accessibilityLabel={`${decks.length} decks`}>
          {decks.map((deck) => (
            <DeckListItem key={deck.id} deck={deck} onPress={() => router.push(`/deck/${deck.id}`)} />
          ))}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  grow: { flexGrow: 1 },
  fill: { width: '100%', height: '100%' },
  controls: { gap: spacing.md },
  list: { gap: spacing.md },
});
