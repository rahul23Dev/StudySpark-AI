import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { ErrorState, LoadingState, ScreenContainer } from '@/components/ui';
import { useRepository } from '@/data/database-context';
import { useFocusQuery } from '@/data/use-query';
import { DeckForm } from '@/features/decks/deck-form';

export default function EditDeckScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const repo = useRepository();
  const load = useCallback(() => repo.getDeck(id), [repo, id]);
  const query = useFocusQuery(load);

  return (
    <ScreenContainer edges={['left', 'right', 'bottom']}>
      {query.status === 'ready' && query.data ? (
        <DeckForm
          initial={query.data}
          submitLabel="Save changes"
          onSubmit={async (values) => {
            await repo.updateDeck(id, values);
            router.back();
          }}
        />
      ) : query.status === 'loading' ? (
        <LoadingState />
      ) : (
        <ErrorState
          message={query.status === 'error' ? "We couldn't load this deck." : 'This deck no longer exists.'}
          onRetry={query.status === 'error' ? query.reload : undefined}
        />
      )}
    </ScreenContainer>
  );
}
