import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, ConfirmDialog, ErrorState, LoadingState, ScreenContainer } from '@/components/ui';
import { useRepository } from '@/data/database-context';
import { useFocusQuery } from '@/data/use-query';
import { CardForm } from '@/features/decks/card-form';
import { spacing } from '@/theme';

export default function EditCardScreen() {
  const { cardId } = useLocalSearchParams<{ id: string; cardId: string }>();
  const router = useRouter();
  const repo = useRepository();
  const load = useCallback(() => repo.getFlashcard(cardId), [repo, cardId]);
  const query = useFocusQuery(load);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);

  async function deleteCard() {
    setDeleting(true);
    setDeleteFailed(false);
    try {
      await repo.deleteFlashcard(cardId);
      setConfirming(false);
      router.back();
    } catch {
      setDeleteFailed(true);
      setDeleting(false);
      setConfirming(false);
    }
  }

  if (query.status === 'loading' && !query.data) {
    return (
      <ScreenContainer edges={['left', 'right', 'bottom']}>
        <LoadingState />
      </ScreenContainer>
    );
  }
  if (!query.data) {
    return (
      <ScreenContainer edges={['left', 'right', 'bottom']}>
        <ErrorState
          message={query.status === 'error' ? "We couldn't load this card." : 'This card no longer exists.'}
          onRetry={query.status === 'error' ? query.reload : undefined}
        />
      </ScreenContainer>
    );
  }

  const card = query.data;
  return (
    <ScreenContainer edges={['left', 'right', 'bottom']}>
      <CardForm
        initial={{ front: card.front, back: card.back, difficulty: card.difficulty }}
        onSubmit={async (values) => {
          await repo.updateFlashcard(cardId, values);
          router.back();
        }}
      />
      <View style={styles.danger}>
        {deleteFailed ? (
          <AppText variant="caption" color="danger" accessibilityRole="alert">
            {"Couldn't delete the card. Please try again."}
          </AppText>
        ) : null}
        <Button label="Delete card" variant="ghost" onPress={() => setConfirming(true)} />
      </View>
      <ConfirmDialog
        visible={confirming}
        title="Delete this card?"
        message="This card will be removed from the deck. This can't be undone."
        confirmLabel="Delete card"
        destructive
        busy={deleting}
        onConfirm={deleteCard}
        onCancel={() => setConfirming(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  danger: { gap: spacing.sm, alignItems: 'center' },
});
