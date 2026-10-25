import { describe, expect, it } from 'vitest';

import {
  FlashcardRequestSchema,
  QuizRequestSchema,
  checkFlashcards,
  checkQuiz,
  groundedQuote,
  type FlashcardModelOutput,
  type QuizModelOutput,
} from './schemas';

const card = (question: string, answer = 'An answer', sourceQuote: string | null = null) => ({
  question,
  answer,
  difficulty: 'medium' as const,
  sourceQuote,
});
const deck = (cards: FlashcardModelOutput['cards'], deckTitle = 'Cells'): FlashcardModelOutput => ({ deckTitle, cards });

const mcq = (question: string, overrides: Partial<QuizModelOutput['questions'][number]> = {}) => ({
  type: 'multiple_choice' as const,
  question,
  options: ['Lungs', 'Liver', 'Heart', 'Kidneys'],
  correctAnswerIndex: 2,
  explanation: 'The heart pumps blood.',
  sourceQuote: null,
  ...overrides,
});
const quiz = (questions: QuizModelOutput['questions'], quizTitle = 'Body'): QuizModelOutput => ({ quizTitle, questions });

describe('request schemas', () => {
  const topic = { source: { type: 'topic', topic: 'Photosynthesis' }, difficulty: 'easy', count: 5 };

  it('accepts a topic request and defaults the language', () => {
    expect(FlashcardRequestSchema.parse(topic)).toMatchObject({ language: 'English', count: 5 });
  });

  it.each([
    ['too many cards', { ...topic, count: 31 }],
    ['zero cards', { ...topic, count: 0 }],
    ['fractional count', { ...topic, count: 2.5 }],
    ['unknown difficulty', { ...topic, difficulty: 'expert' }],
    ['empty topic', { ...topic, source: { type: 'topic', topic: ' ' } }],
    ['notes too short', { ...topic, source: { type: 'notes', notes: 'short' } }],
    ['notes too long', { ...topic, source: { type: 'notes', notes: 'x'.repeat(20_001) } }],
    ['unknown field', { ...topic, apiKey: 'sk-ant-should-not-be-here' }],
  ])('rejects %s', (_label, body) => {
    expect(FlashcardRequestSchema.safeParse(body).success).toBe(false);
  });

  it('limits quiz requests to 20 questions and known types', () => {
    expect(QuizRequestSchema.safeParse({ ...topic, count: 20 }).success).toBe(true);
    expect(QuizRequestSchema.safeParse({ ...topic, count: 21 }).success).toBe(false);
    expect(QuizRequestSchema.safeParse({ ...topic, questionTypes: 'essay' }).success).toBe(false);
  });
});

describe('checkFlashcards', () => {
  const opts = { requestedCount: 2, notes: null, final: false };

  it('accepts exactly the requested number of valid cards, trimmed', () => {
    const result = checkFlashcards(deck([card('  What is a cell? '), card('What is DNA?')]), opts);
    expect(result).toEqual({
      ok: true,
      value: {
        title: 'Cells',
        cards: [
          { question: 'What is a cell?', answer: 'An answer', difficulty: 'medium' },
          { question: 'What is DNA?', answer: 'An answer', difficulty: 'medium' },
        ],
      },
    });
  });

  it('rejects duplicates (ignoring case and punctuation) and empty fields', () => {
    const result = checkFlashcards(deck([card('What is a cell?'), card('what is a CELL'), card('Empty?', '  ')]), opts);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join(' ')).toMatch(/duplicates/);
      expect(result.issues.join(' ')).toMatch(/answer is empty/);
      expect(result.issues.join(' ')).toMatch(/Expected exactly 2 valid cards, got 1/);
    }
  });

  it('rejects the wrong count, but trims a surplus on the final attempt', () => {
    const three = deck([card('A?'), card('B?'), card('C?')]);
    expect(checkFlashcards(three, opts).ok).toBe(false);
    const trimmed = checkFlashcards(three, { ...opts, final: true });
    expect(trimmed.ok && trimmed.value.cards.map((c) => c.question)).toEqual(['A?', 'B?']);
    expect(checkFlashcards(deck([card('A?')]), { ...opts, final: true }).ok).toBe(false); // never padded
  });

  it('rejects over-long text and a missing title', () => {
    expect(checkFlashcards(deck([card('Q'.repeat(301)), card('B?')]), opts).ok).toBe(false);
    expect(checkFlashcards(deck([card('A?'), card('B?')], ' '), opts).ok).toBe(false);
  });

  it('keeps source quotes only when they really appear in the notes', () => {
    const notes = 'Mitochondria are the   powerhouse of the cell. Ribosomes build proteins.';
    const result = checkFlashcards(
      deck([card('Powerhouse?', 'Mitochondria', 'mitochondria are the powerhouse of the cell'), card('Proteins?', 'Ribosomes', 'invented quote not in notes')]),
      { ...opts, notes },
    );
    expect(result.ok && result.value.cards[0].sourceQuote).toBe('mitochondria are the powerhouse of the cell');
    expect(result.ok && 'sourceQuote' in result.value.cards[1]).toBe(false);
  });

  it('never attaches source quotes to topic-based cards', () => {
    const result = checkFlashcards(deck([card('A?', 'a', 'some quote here'), card('B?')]), opts);
    expect(result.ok && result.value.cards.every((c) => !c.sourceQuote)).toBe(true);
  });
});

describe('checkQuiz', () => {
  const opts = { requestedCount: 1, notes: null, final: false, questionTypes: 'mixed' as const };

  it('accepts a valid multiple-choice question', () => {
    const result = checkQuiz(quiz([mcq('Which organ pumps blood?')]), opts);
    expect(result.ok && result.value.questions[0]).toMatchObject({ correctAnswerIndex: 2, options: ['Lungs', 'Liver', 'Heart', 'Kidneys'] });
  });

  it.each([
    ['three options', mcq('Q?', { options: ['A', 'B', 'C'] }), /exactly 4 options/],
    ['duplicate options', mcq('Q?', { options: ['A', 'B', 'b', 'C'] }), /duplicate options/],
    ['index out of range', mcq('Q?', { correctAnswerIndex: 4 }), /invalid correctAnswerIndex/],
    ['negative index', mcq('Q?', { correctAnswerIndex: -1 }), /invalid correctAnswerIndex/],
    ['missing explanation', mcq('Q?', { explanation: ' ' }), /explanation is empty/],
    ['empty option', mcq('Q?', { options: ['A', '', 'C', 'D'] }), /option 2 is empty/],
  ])('rejects %s', (_label, question, pattern) => {
    const result = checkQuiz(quiz([question]), opts);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.join(' ')).toMatch(pattern);
  });

  it('normalises true/false options and remaps a reversed answer', () => {
    const tf = { type: 'true_false' as const, question: 'Plants make oxygen.', options: ['false', 'TRUE'], correctAnswerIndex: 1, explanation: 'Photosynthesis.', sourceQuote: null };
    const result = checkQuiz(quiz([tf]), opts);
    expect(result.ok && result.value.questions[0]).toMatchObject({ options: ['True', 'False'], correctAnswerIndex: 0 });
    const bad = checkQuiz(quiz([{ ...tf, options: ['Yes', 'No'] }]), opts);
    expect(bad.ok).toBe(false);
  });

  it('enforces the requested question type and rejects duplicate questions', () => {
    const tfOnly = checkQuiz(quiz([mcq('Q?')]), { ...opts, questionTypes: 'true_false' });
    expect(tfOnly.ok).toBe(false);
    const dup = checkQuiz(quiz([mcq('Which organ pumps blood?'), mcq('Which organ pumps blood')]), { ...opts, requestedCount: 2 });
    expect(dup.ok).toBe(false);
  });
});

describe('groundedQuote', () => {
  it('ignores tiny or missing quotes', () => {
    expect(groundedQuote('cell', 'the cell')).toBeUndefined();
    expect(groundedQuote(null, 'notes')).toBeUndefined();
    expect(groundedQuote('a long enough quote', null)).toBeUndefined();
  });
});
