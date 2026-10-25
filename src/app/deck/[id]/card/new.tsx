import { useLocalSearchParams, useRouter } from 'expo-router';

import { ScreenContainer } from '@/components/ui';
import { useRepository } from '@/data/database-context';
import { CardForm } from '@/features/decks/card-form';

export default function NewCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const repo = useRepository();
  return (
    <ScreenContainer edges={['left', 'right', 'bottom']}>
      <CardForm
        onSubmit={async (values) => {
          await repo.createFlashcard(id, values);
          router.back();
        }}
        onSubmitAndAddAnother={async (values) => {
          await repo.createFlashcard(id, values);
        }}
      />
    </ScreenContainer>
  );
}
