import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, MIN_TOUCH_TARGET, radii, spacing, typography } from '@/theme';

import { AppText } from './app-text';

export type InputProps = Omit<TextInputProps, 'style'> & {
  label: string;
  helperText?: string;
  errorText?: string;
};

/** Labelled text field. The label doubles as the accessibility label. */
export function Input({ label, helperText, errorText, onFocus, onBlur, editable = true, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  const message = errorText ?? helperText;
  return (
    <View style={styles.container}>
      <AppText variant="caption" color="text">
        {label}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={helperText}
        aria-invalid={!!errorText}
        editable={editable}
        placeholderTextColor={colors.textMuted}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.field,
          rest.multiline && styles.multiline,
          focused && styles.focused,
          errorText ? styles.error : null,
          !editable && styles.disabled,
        ]}
        {...rest}
      />
      {message ? (
        <AppText variant="caption" color={errorText ? 'danger' : 'textMuted'} accessibilityLiveRegion="polite">
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  field: {
    ...typography.body,
    color: colors.text,
    minHeight: MIN_TOUCH_TARGET + 4,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  multiline: { minHeight: 112, paddingTop: spacing.md, paddingBottom: spacing.md, textAlignVertical: 'top' },
  focused: { borderColor: colors.primary },
  error: { borderColor: colors.danger },
  disabled: { backgroundColor: colors.surfaceMuted, color: colors.textMuted },
});
