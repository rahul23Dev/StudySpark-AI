import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Input } from '@/components/ui';
import type { DeckInput } from '@/data/types';
import { LIMITS } from '@/data/validation';
import { spacing } from '@/theme';

import { fieldErrors } from './format';

export type DeckFormProps = {
  initial?: Pick<DeckInput, 'title' | 'subject' | 'description'>;
  submitLabel: string;
  /** Throws a ValidationError (shown per field) or any other error (shown below). */
  onSubmit: (values: Required<Pick<DeckInput, 'title' | 'subject' | 'description'>>) => Promise<void>;
};

export function DeckForm({ initial, submitLabel, onSubmit }: DeckFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!title.trim()) {
      setErrors({ title: 'Title is required.' });
      return;
    }
    setSaving(true);
    setErrors({});
    setFailure(null);
    try {
      await onSubmit({ title, subject, description });
    } catch (error) {
      const issues = fieldErrors(error);
      if (issues) setErrors(issues);
      else setFailure("Couldn't save the deck. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.form}>
      <Input
        label="Title"
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Cell biology"
        maxLength={LIMITS.deckTitle}
        autoFocus={!initial}
        returnKeyType="next"
        errorText={errors.title}
      />
      <Input
        label="Subject (optional)"
        value={subject}
        onChangeText={setSubject}
        placeholder="e.g. Science"
        maxLength={LIMITS.deckSubject}
        errorText={errors.subject}
      />
      <Input
        label="Description (optional)"
        value={description}
        onChangeText={setDescription}
        placeholder="What is this deck for?"
        maxLength={LIMITS.deckDescription}
        multiline
        errorText={errors.description}
      />
      {failure ? (
        <AppText variant="caption" color="danger" accessibilityRole="alert">
          {failure}
        </AppText>
      ) : null}
      <Button label={submitLabel} onPress={submit} loading={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
});
