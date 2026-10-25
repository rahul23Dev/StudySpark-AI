import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, ConfirmDialog, ErrorState, LoadingState, ScreenContainer } from '@/components/ui';
import { useRepository } from '@/data/database-context';
import { useFocusQuery } from '@/data/use-query';
import { QuestionForm } from '@/features/decks/question-form';
import { spacing } from '@/theme';

export default function EditQuestionScreen() {
  const { questionId } = useLocalSearchParams<{ id: string; questionId: string }>();
  const router = useRouter();
  const repo = useRepository();
  const load = useCallback(() => repo.getQuizQuestion(questionId), [repo, questionId]);
  const query = useFocusQuery(load);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);

  const edges = ['left', 'right', 'bottom'] as const;
  if (!query.data) {
    return (
      <ScreenContainer edges={[...edges]}>
        {query.status === 'loading' ? (
          <LoadingState />
        ) : (
          <ErrorState
            message={query.status === 'error' ? "We couldn't load this question." : 'This question no longer exists.'}
            onRetry={query.status === 'error' ? query.reload : undefined}
          />
        )}
      </ScreenContainer>
    );
  }

  const question = query.data;
  return (
    <ScreenContainer edges={[...edges]}>
      <QuestionForm
        initial={question}
        onSubmit={async (values) => {
          await repo.updateQuizQuestion(questionId, values);
          router.back();
        }}
      />
      <View style={styles.danger}>
        {deleteFailed ? (
          <AppText variant="caption" color="danger" accessibilityRole="alert">
            {"Couldn't delete the question. Please try again."}
          </AppText>
        ) : null}
        <Button label="Delete question" variant="ghost" onPress={() => setConfirming(true)} />
      </View>
      <ConfirmDialog
        visible={confirming}
        title="Delete this question?"
        message="It will be removed from the deck's quiz. This can't be undone."
        confirmLabel="Delete question"
        destructive
        busy={deleting}
        onCancel={() => setConfirming(false)}
        onConfirm={async () => {
          setDeleting(true);
          setDeleteFailed(false);
          try {
            await repo.deleteQuizQuestion(questionId);
            setConfirming(false);
            router.back();
          } catch {
            setDeleteFailed(true);
            setConfirming(false);
          } finally {
            setDeleting(false);
          }
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  danger: { gap: spacing.sm, alignItems: 'center' },
});
