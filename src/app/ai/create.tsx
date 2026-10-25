import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AI_LIMITS,
  AiClientError,
  generate,
  type Difficulty,
  type Generation,
  type GenerationKind,
  type QuizTypes,
} from '@/ai/client';
import { deckFromGeneration } from '@/ai/to-deck';
import { artwork } from '@/components/artwork';
import { AiSparkIcon } from '@/components/illustrations';
import { AppText, Button, Card, Input, ScreenContainer, SectionTitle, SegmentedControl } from '@/components/ui';
import { useRepository } from '@/data/database-context';
import { GenerationPreview } from '@/features/ai/generation-preview';
import { fieldErrors } from '@/features/decks/format';
import { colors, radii, spacing } from '@/theme';

type SourceType = 'topic' | 'notes';
type Phase = 'form' | 'generating' | 'error' | 'review';

const KIND_OPTIONS = [
  { value: 'flashcards', label: 'Flashcards' },
  { value: 'quiz', label: 'Quiz' },
] as const;
const SOURCE_OPTIONS = [
  { value: 'topic', label: 'A topic' },
  { value: 'notes', label: 'My notes' },
] as const;
const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
] as const;
const COUNT_OPTIONS = [
  { value: '5', label: '5' },
  { value: '10', label: '10' },
  { value: '15', label: '15' },
  { value: '20', label: '20' },
] as const;
const QUIZ_TYPE_OPTIONS = [
  { value: 'mixed', label: 'Mixed' },
  { value: 'multiple_choice', label: 'Multiple choice' },
  { value: 'true_false', label: 'True or false' },
] as const;

export default function CreateWithAiScreen() {
  const router = useRouter();
  const repo = useRepository();

  const [kind, setKind] = useState<GenerationKind>('flashcards');
  const [sourceType, setSourceType] = useState<SourceType>('topic');
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [language, setLanguage] = useState('English');
  const [count, setCount] = useState<(typeof COUNT_OPTIONS)[number]['value']>('10');
  const [quizTypes, setQuizTypes] = useState<QuizTypes>('mixed');
  const [formError, setFormError] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>('form');
  const [error, setError] = useState<AiClientError | null>(null);
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const source = sourceType === 'topic' ? { type: 'topic' as const, topic: topic.trim() } : { type: 'notes' as const, notes: notes.trim() };

  function validateForm(): string | null {
    if (sourceType === 'topic' && topic.trim().length < AI_LIMITS.topic.min) return 'Enter a topic to study.';
    if (sourceType === 'notes' && notes.trim().length < AI_LIMITS.notes.min) {
      return `Paste at least ${AI_LIMITS.notes.min} characters of notes.`;
    }
    if (language.trim().length < 2) return 'Enter a language, e.g. English.';
    return null;
  }

  async function run() {
    const problem = validateForm();
    setFormError(problem);
    if (problem) return;
    abort.current = new AbortController();
    setPhase('generating');
    setError(null);
    try {
      const result = await generate(
        kind,
        { source, difficulty, language: language.trim(), count: Number(count), questionTypes: quizTypes },
        { signal: abort.current.signal },
      );
      setGeneration(result);
      setTitle(result.kind === 'flashcards' ? result.deck.title : result.quiz.title);
      setPhase('review');
    } catch (e) {
      const err = e instanceof AiClientError ? e : new AiClientError('unknown', 'Something went wrong. Please try again.', true);
      if (err.code === 'cancelled') {
        setPhase('form');
        return;
      }
      setError(err);
      setPhase('error');
    } finally {
      abort.current = null;
    }
  }

  async function save() {
    if (!generation) return;
    setSaving(true);
    setSaveError(null);
    try {
      const deck = await repo.createDeckWithContent(deckFromGeneration(generation, source, title));
      router.replace({ pathname: '/deck/[id]', params: { id: deck.id, created: '1' } });
    } catch (e) {
      const issues = fieldErrors(e);
      setSaveError(
        issues?.title ?? (issues ? 'Some generated items could not be saved. Nothing was saved.' : "Couldn't save the deck. Nothing was saved; please try again."),
      );
    } finally {
      setSaving(false);
    }
  }

  const illustration = (image: number) => (
    <View style={styles.art} aria-hidden>
      <Image source={image} style={styles.fill} contentFit="contain" />
    </View>
  );

  if (phase === 'generating') {
    return (
      <ScreenContainer edges={['left', 'right', 'bottom']} contentStyle={styles.centered}>
        {illustration(artwork.generationLoading.source)}
        <AppText variant="heading" style={styles.center} accessibilityRole="header" accessibilityLiveRegion="polite">
          {kind === 'flashcards' ? 'Creating your flashcards…' : 'Writing your quiz…'}
        </AppText>
        <AppText variant="body" color="textMuted" style={styles.center}>
          This usually takes under a minute. Your existing decks aren&apos;t affected.
        </AppText>
        <Button label="Cancel" variant="secondary" onPress={() => abort.current?.abort()} />
      </ScreenContainer>
    );
  }

  if (phase === 'error' && error) {
    return (
      <ScreenContainer edges={['left', 'right', 'bottom']} contentStyle={styles.centered}>
        {illustration(artwork.generationError.source)}
        <AppText variant="heading" style={styles.center} accessibilityRole="header">
          {error.code === 'ai_not_configured' || error.code === 'app_not_configured' ? 'AI isn’t set up yet' : 'That didn’t work'}
        </AppText>
        <AppText variant="body" color="textMuted" style={styles.center} accessibilityRole="alert">
          {error.message}
        </AppText>
        <AppText variant="caption" color="textMuted" style={styles.center}>
          Your existing decks are safe. Nothing was saved.
        </AppText>
        <View style={styles.actions}>
          {error.retryable ? <Button label="Try again" onPress={run} /> : null}
          <Button label="Edit request" variant="secondary" onPress={() => setPhase('form')} />
        </View>
      </ScreenContainer>
    );
  }

  if (phase === 'review' && generation) {
    const items = generation.kind === 'flashcards' ? generation.deck.cards.length : generation.quiz.questions.length;
    return (
      <ScreenContainer edges={['left', 'right', 'bottom']}>
        <Card tone="amber" style={styles.notice}>
          <AiSparkIcon width={24} height={24} />
          <AppText variant="body" style={styles.flex}>
            Generated by AI. AI can make mistakes, so check these {generation.kind === 'flashcards' ? 'cards' : 'questions'} before
            you study. You can edit them after saving.
          </AppText>
        </Card>
        <Input label="Deck title" value={title} onChangeText={setTitle} maxLength={80} />
        <SectionTitle>{`${items} ${generation.kind === 'flashcards' ? 'cards' : 'questions'}`}</SectionTitle>
        <GenerationPreview generation={generation} />
        {saveError ? (
          <AppText variant="caption" color="danger" accessibilityRole="alert">
            {saveError}
          </AppText>
        ) : null}
        <Button label="Save as deck" onPress={save} loading={saving} disabled={!title.trim()} />
        <Button label="Discard and start over" variant="ghost" onPress={() => setPhase('form')} disabled={saving} />
      </ScreenContainer>
    );
  }

  const max = kind === 'quiz' ? AI_LIMITS.quiz.max : AI_LIMITS.flashcards.max;
  return (
    <ScreenContainer edges={['left', 'right', 'bottom']}>
      <Card style={styles.hero}>
        {illustration(artwork.aiCreate.source)}
        <AppText variant="heading" style={styles.center}>
          Turn a topic or your notes into study material
        </AppText>
      </Card>

      <View style={styles.field}>
        <AppText variant="caption">What to create</AppText>
        <SegmentedControl accessibilityLabel="What to create" options={KIND_OPTIONS} value={kind} onChange={setKind} />
      </View>
      <View style={styles.field}>
        <AppText variant="caption">Create from</AppText>
        <SegmentedControl accessibilityLabel="Create from" options={SOURCE_OPTIONS} value={sourceType} onChange={setSourceType} />
      </View>

      {sourceType === 'topic' ? (
        <Input
          label="Topic"
          value={topic}
          onChangeText={setTopic}
          placeholder="e.g. Photosynthesis, the French Revolution"
          maxLength={AI_LIMITS.topic.max}
          returnKeyType="done"
        />
      ) : (
        <Input
          label="Your notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Paste your notes here. Cards will only use what's in them."
          maxLength={AI_LIMITS.notes.max}
          multiline
          helperText={`${notes.length.toLocaleString()} / ${AI_LIMITS.notes.max.toLocaleString()} characters. To generate, your notes are sent to the StudySpark server and its AI provider (Anthropic). The server doesn't save them.`}
        />
      )}

      <View style={styles.field}>
        <AppText variant="caption">Difficulty</AppText>
        <SegmentedControl accessibilityLabel="Difficulty" options={DIFFICULTY_OPTIONS} value={difficulty} onChange={setDifficulty} />
      </View>
      <View style={styles.field}>
        <AppText variant="caption">How many {kind === 'quiz' ? 'questions' : 'cards'}</AppText>
        <SegmentedControl
          accessibilityLabel={`Number of ${kind === 'quiz' ? 'questions' : 'cards'}`}
          options={COUNT_OPTIONS.filter((o) => Number(o.value) <= max)}
          value={count}
          onChange={setCount}
        />
      </View>
      {kind === 'quiz' ? (
        <View style={styles.field}>
          <AppText variant="caption">Question types</AppText>
          <SegmentedControl accessibilityLabel="Question types" options={QUIZ_TYPE_OPTIONS} value={quizTypes} onChange={setQuizTypes} />
        </View>
      ) : null}
      <Input label="Language" value={language} onChangeText={setLanguage} maxLength={40} autoCapitalize="words" />

      {formError ? (
        <AppText variant="caption" color="danger" accessibilityRole="alert">
          {formError}
        </AppText>
      ) : null}
      <Button label={kind === 'quiz' ? 'Generate quiz' : 'Generate flashcards'} icon={<AiSparkIcon width={20} height={20} />} onPress={run} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centered: { justifyContent: 'center', alignItems: 'center' },
  center: { textAlign: 'center' },
  art: { width: '70%', maxWidth: 240, aspectRatio: 4 / 3 },
  fill: { width: '100%', height: '100%' },
  hero: { alignItems: 'center', gap: spacing.sm },
  field: { gap: spacing.sm },
  actions: { gap: spacing.md, alignSelf: 'stretch' },
  notice: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', borderRadius: radii.lg, borderColor: colors.amberSoft },
  flex: { flex: 1 },
});
