import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Input, SegmentedControl } from '@/components/ui';
import type { QuestionType, QuizQuestionInput } from '@/data/types';
import { LIMITS } from '@/data/validation';
import { colors, MIN_TOUCH_TARGET, radii, spacing } from '@/theme';

import { fieldErrors } from './format';

const TYPE_OPTIONS: readonly { value: QuestionType; label: string }[] = [
  { value: 'multiple_choice', label: 'Multiple choice' },
  { value: 'true_false', label: 'True or false' },
];
const TRUE_FALSE = ['True', 'False'];

export type QuestionFormProps = {
  initial?: QuizQuestionInput;
  onSubmit: (values: QuizQuestionInput) => Promise<void>;
};

export function QuestionForm({ initial, onSubmit }: QuestionFormProps) {
  const [type, setType] = useState<QuestionType>(initial?.type ?? 'multiple_choice');
  const [question, setQuestion] = useState(initial?.question ?? '');
  const [options, setOptions] = useState<string[]>(
    initial?.type === 'multiple_choice' ? initial.options : ['', '', '', ''],
  );
  const [correct, setCorrect] = useState<number | null>(initial?.correctAnswerIndex ?? null);
  const [explanation, setExplanation] = useState(initial?.explanation ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState(false);
  const [saving, setSaving] = useState(false);

  const shownOptions = type === 'true_false' ? TRUE_FALSE : options;

  function changeType(next: QuestionType) {
    setType(next);
    setCorrect(null);
    setErrors({});
  }

  function removeOption(index: number) {
    setOptions((list) => list.filter((_, i) => i !== index));
    setCorrect((c) => (c === null || c === index ? null : c > index ? c - 1 : c));
  }

  async function submit() {
    // Blank multiple-choice rows are dropped rather than rejected; the correct-answer
    // index is remapped to the kept rows (-1 if the marked row was blank).
    const rows = options.map((text, index) => ({ text, index })).filter((row) => row.text.trim());
    const values: QuizQuestionInput =
      type === 'true_false'
        ? { type, question, options: TRUE_FALSE, correctAnswerIndex: correct ?? -1, explanation }
        : {
            type,
            question,
            options: rows.map((row) => row.text),
            correctAnswerIndex: rows.findIndex((row) => row.index === correct),
            explanation,
          };
    setSaving(true);
    setErrors({});
    setFailure(false);
    try {
      await onSubmit(values);
    } catch (error) {
      const issues = fieldErrors(error);
      if (issues) setErrors(issues);
      else setFailure(true);
    } finally {
      setSaving(false);
    }
  }

  const optionError = errors.options ?? Object.entries(errors).find(([k]) => k.startsWith('options.'))?.[1];

  return (
    <View style={styles.form}>
      <View style={styles.field}>
        <AppText variant="caption">Question type</AppText>
        <SegmentedControl accessibilityLabel="Question type" options={TYPE_OPTIONS} value={type} onChange={changeType} />
      </View>

      <Input
        label="Question"
        value={question}
        onChangeText={setQuestion}
        placeholder={type === 'true_false' ? 'e.g. Plants produce oxygen.' : 'e.g. Which organ pumps blood?'}
        maxLength={LIMITS.question}
        multiline
        errorText={errors.question}
      />

      <View style={styles.field} accessibilityRole="radiogroup" accessibilityLabel="Answer options. Choose the correct one.">
        <AppText variant="caption">
          {type === 'true_false' ? 'Correct answer' : 'Options (choose the correct one)'}
        </AppText>
        {shownOptions.map((option, index) => {
          const isCorrect = correct === index;
          return (
            <View key={type === 'true_false' ? option : index} style={styles.optionRow}>
              <Pressable
                accessibilityRole="radio"
                aria-checked={isCorrect}
                accessibilityLabel={`Mark ${type === 'true_false' ? option : `option ${index + 1}`} as correct`}
                onPress={() => setCorrect(index)}
                style={[styles.radio, isCorrect && styles.radioOn]}>
                {isCorrect ? <View style={styles.radioDot} /> : null}
              </Pressable>
              {type === 'true_false' ? (
                <AppText variant="label" style={styles.flex}>
                  {option}
                </AppText>
              ) : (
                <View style={styles.flex}>
                  <Input
                    label={`Option ${index + 1}`}
                    value={option}
                    onChangeText={(text) => setOptions((list) => list.map((o, i) => (i === index ? text : o)))}
                    maxLength={LIMITS.option}
                    errorText={errors[`options.${index}`]}
                  />
                </View>
              )}
              {type === 'multiple_choice' && options.length > LIMITS.minOptions ? (
                <Button label="Remove" variant="ghost" compact onPress={() => removeOption(index)} />
              ) : null}
            </View>
          );
        })}
        {type === 'multiple_choice' && options.length < LIMITS.maxOptions ? (
          <Button label="Add option" variant="secondary" compact onPress={() => setOptions((list) => [...list, ''])} />
        ) : null}
        {optionError || errors.correctAnswerIndex ? (
          <AppText variant="caption" color="danger" accessibilityRole="alert">
            {optionError ?? errors.correctAnswerIndex}
          </AppText>
        ) : null}
      </View>

      <Input
        label="Explanation (optional)"
        value={explanation}
        onChangeText={setExplanation}
        placeholder="Shown after answering"
        maxLength={LIMITS.explanation}
        multiline
        errorText={errors.explanation}
      />

      {failure ? (
        <AppText variant="caption" color="danger" accessibilityRole="alert">
          {"Couldn't save the question. Please try again."}
        </AppText>
      ) : null}
      <Button label="Save question" onPress={submit} loading={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  field: { gap: spacing.sm },
  flex: { flex: 1 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  radio: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  radioDot: { width: 18, height: 18, borderRadius: radii.pill, backgroundColor: colors.primaryText },
});
