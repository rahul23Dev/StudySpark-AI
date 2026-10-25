import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { colors, radii, shadows, spacing } from '@/theme';

import { AppText } from './app-text';
import { Button } from './button';

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Destructive actions get the red button. */
  destructive?: boolean;
  busy?: boolean;
};

/** In-app confirmation (works the same on iOS, Android and web, unlike Alert buttons on web). */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  destructive,
  busy,
}: ConfirmDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      // On web the fade relies on CSS animationend, which never fires in a background
      // tab, leaving the dialog stuck open; show/hide instantly there instead.
      animationType={Platform.OS === 'web' ? 'none' : 'fade'}
      onRequestClose={onCancel}
      statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Cancel" onPress={onCancel} disabled={busy} />
        <View style={styles.dialog} testID="confirm-dialog" accessibilityRole="alert" aria-modal accessibilityViewIsModal>
          <AppText variant="heading" accessibilityRole="header">
            {title}
          </AppText>
          <AppText variant="body" color="textMuted">
            {message}
          </AppText>
          <View style={styles.actions}>
            <Button label="Cancel" variant="secondary" compact onPress={onCancel} disabled={busy} />
            <Button
              label={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              compact
              onPress={onConfirm}
              loading={busy}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(21, 34, 56, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.raised,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
});
