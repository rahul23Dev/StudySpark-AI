import { useRouter } from 'expo-router';

import { ScreenContainer } from '@/components/ui';
import { useRepository } from '@/data/database-context';
import { DeckForm } from '@/features/decks/deck-form';

export default function NewDeckScreen() {
  const router = useRouter();
  const repo = useRepository();
  return (
    <ScreenContainer edges={['left', 'right', 'bottom']}>
      <DeckForm
        submitLabel="Create deck"
        onSubmit={async (values) => {
          const deck = await repo.createDeck(values);
          router.replace({ pathname: '/deck/[id]', params: { id: deck.id, created: '1' } });
        }}
      />
    </ScreenContainer>
  );
}
