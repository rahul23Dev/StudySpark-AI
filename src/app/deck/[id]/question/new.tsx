import { useLocalSearchParams, useRouter } from 'expo-router';

import { ScreenContainer } from '@/components/ui';
import { useRepository } from '@/data/database-context';
import { QuestionForm } from '@/features/decks/question-form';

export default function NewQuestionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const repo = useRepository();
  return (
    <ScreenContainer edges={['left', 'right', 'bottom']}>
      <QuestionForm
        onSubmit={async (values) => {
          await repo.createQuizQuestion(id, values);
          router.back();
        }}
      />
    </ScreenContainer>
  );
}
