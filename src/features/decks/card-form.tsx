import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Input, SegmentedControl } from '@/components/ui';
import type { Difficulty, FlashcardInput } from '@/data/types';
import { LIMITS } from '@/data/validation';
import { spacing } from '@/theme';

import { fieldErrors } from './format';

const DIFFICULTY_OPTIONS: readonly { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

export type CardFormValues = Required<FlashcardInput>;

export type CardFormProps = {
  initial?: CardFormValues;
  /** Throws a ValidationError (shown per field) or any other error (shown below). */
  onSubmit: (values: CardFormValues) => Promise<void>;
  /** New cards only: saves and clears the form for the next card. */
  onSubmitAndAddAnother?: (values: CardFormValues) => Promise<void>;
};

export function CardForm({ initial, onSubmit, onSubmitAndAddAnother }: CardFormProps) {
  const [front, setFront] = useState(initial?.front ?? '');
  const [back, setBack] = useState(initial?.back ?? '');
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty ?? 'medium');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'saving' | 'added' | 'failed'>('idle');

  async function submit(handler: (values: CardFormValues) => Promise<void>, clearAfter: boolean) {
    const missing: Record<string, string> = {};
    if (!front.trim()) missing.front = 'Front is required.';
    if (!back.trim()) missing.back = 'Back is required.';
    if (Object.keys(missing).length) {
      setErrors(missing);
      return;
    }
    setStatus('saving');
    setErrors({});
    try {
      await handler({ front, back, difficulty });
      if (clearAfter) {
        setFront('');
        setBack('');
        setStatus('added');
      } else {
        setStatus('idle');
      }
    } catch (error) {
      const issues = fieldErrors(error);
      if (issues) {
        setErrors(issues);
        setStatus('idle');
      } else {
        setStatus('failed');
      }
    }
  }

  const saving = status === 'saving';
  return (
    <View style={styles.form}>
      <Input
        label="Front"
        value={front}
        onChangeText={(t) => {
          setFront(t);
          if (status === 'added') setStatus('idle');
        }}
        placeholder="Question or term"
        maxLength={LIMITS.cardFront}
        multiline
        autoFocus={!initial}
        errorText={errors.front}
      />
      <Input
        label="Back"
        value={back}
        onChangeText={setBack}
        placeholder="Answer or definition"
        maxLength={LIMITS.cardBack}
        multiline
        errorText={errors.back}
      />
      <View style={styles.field}>
        <AppText variant="caption">Difficulty</AppText>
        <SegmentedControl
          accessibilityLabel="Difficulty"
          options={DIFFICULTY_OPTIONS}
          value={difficulty}
          onChange={setDifficulty}
        />
      </View>
      {status === 'added' ? (
        <AppText variant="caption" color="success" accessibilityLiveRegion="polite">
          Card added. Add the next one.
        </AppText>
      ) : null}
      {status === 'failed' ? (
        <AppText variant="caption" color="danger" accessibilityRole="alert">
          {"Couldn't save the card. Please try again."}
        </AppText>
      ) : null}
      <Button label="Save card" onPress={() => submit(onSubmit, false)} loading={saving} />
      {onSubmitAndAddAnother ? (
        <Button
          label="Save and add another"
          variant="secondary"
          onPress={() => submit(onSubmitAndAddAnother, true)}
          disabled={saving}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  field: { gap: spacing.sm },
});
