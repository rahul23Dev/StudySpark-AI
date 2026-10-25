import { describe, expect, it } from 'vitest';

import { InvalidModelOutputError, ProviderRateLimitError, RefusalError } from '@/errors';

import { generateFlashcards, generateQuiz } from './generate';
import { UnusableOutputError, usageOf, type AiProvider, type StructuredRequest } from './provider';
import type { FlashcardRequest, QuizRequest } from './schemas';

/** Plays back scripted replies (data, or an error to throw), recording each prompt. */
function scriptedProvider(replies: unknown[]): AiProvider & { prompts: string[] } {
  const prompts: string[] = [];
  return {
    name: 'fake',
    model: 'claude-opus-5-5',
    prompts,
    async generateStructured<T>(req: StructuredRequest<T>) {
      prompts.push(req.prompt);
      const next = replies.shift();
      if (next instanceof Error) throw next;
      if (next === undefined) throw new Error('no scripted reply left');
      return { data: next as T, usage: { inputTokens: 100, outputTokens: 50 }, model: 'claude-opus-5-5' };
    },
  };
}

const flashRequest: FlashcardRequest = {
  source: { type: 'topic', topic: 'Cells' },
  difficulty: 'easy',
  language: 'English',
  count: 2,
};
const goodDeck = {
  deckTitle: 'Cells',
  cards: [
    { question: 'What is a cell?', answer: 'The basic unit of life', difficulty: 'easy', sourceQuote: null },
    { question: 'What is DNA?', answer: 'Genetic material', difficulty: 'easy', sourceQuote: null },
  ],
};

describe('generateFlashcards', () => {
  it('returns validated cards with usage and attempt count', async () => {
    const provider = scriptedProvider([goodDeck]);
    const out = await generateFlashcards(provider, flashRequest, { maxAttempts: 2 });
    expect(out.result.cards).toHaveLength(2);
    expect(out.meta).toEqual({ model: 'claude-opus-5-5', attempts: 1, usage: { inputTokens: 100, outputTokens: 50 } });
    expect(provider.prompts[0]).toContain('Create exactly 2 flashcards.');
    expect(provider.prompts[0]).toContain('Topic: Cells');
  });

  it('retries once with the problems listed when output fails validation', async () => {
    const tooFew = { deckTitle: 'Cells', cards: [goodDeck.cards[0]] };
    const provider = scriptedProvider([tooFew, goodDeck]);
    const out = await generateFlashcards(provider, flashRequest, { maxAttempts: 2 });
    expect(out.meta.attempts).toBe(2);
    expect(out.meta.usage).toEqual({ inputTokens: 200, outputTokens: 100 });
    expect(provider.prompts[1]).toContain('Expected exactly 2 valid cards, got 1');
  });

  it('gives up after the attempt limit, keeping the usage spent', async () => {
    const tooFew = { deckTitle: 'Cells', cards: [goodDeck.cards[0]] };
    const provider = scriptedProvider([tooFew, tooFew]);
    const error = await generateFlashcards(provider, flashRequest, { maxAttempts: 2 }).catch((e) => e);
    expect(error).toBeInstanceOf(InvalidModelOutputError);
    expect(error.status).toBe(502);
    expect(usageOf(error)).toEqual({ inputTokens: 200, outputTokens: 100 });
  });

  it('retries after unusable (truncated / malformed) output', async () => {
    const provider = scriptedProvider([new UnusableOutputError('cut off', { inputTokens: 10, outputTokens: 5 }), goodDeck]);
    const out = await generateFlashcards(provider, flashRequest, { maxAttempts: 2 });
    expect(out.meta).toMatchObject({ attempts: 2, usage: { inputTokens: 110, outputTokens: 55 } });
    expect(provider.prompts[1]).toContain('cut off');
  });

  it('does not retry provider errors itself (the SDK already retried them)', async () => {
    const provider = scriptedProvider([new ProviderRateLimitError(5), goodDeck]);
    await expect(generateFlashcards(provider, flashRequest, { maxAttempts: 2 })).rejects.toBeInstanceOf(ProviderRateLimitError);
    expect(provider.prompts).toHaveLength(1);
  });

  it('passes refusals through without retrying', async () => {
    const provider = scriptedProvider([new RefusalError()]);
    await expect(generateFlashcards(provider, flashRequest, { maxAttempts: 3 })).rejects.toBeInstanceOf(RefusalError);
    expect(provider.prompts).toHaveLength(1);
  });

  it('wraps notes as study material in the prompt', async () => {
    const provider = scriptedProvider([goodDeck]);
    // (The request schema has already trimmed notes by the time they reach the generator.)
    const notes = 'Cells are the basic unit of life. DNA carries genetic information.';
    await generateFlashcards(provider, { ...flashRequest, source: { type: 'notes', notes } }, { maxAttempts: 1 });
    expect(provider.prompts[0]).toContain(`<notes>\n${notes}\n</notes>`);
    expect(provider.prompts[0]).not.toContain('Topic:');
  });
});

describe('generateQuiz', () => {
  const quizRequest: QuizRequest = { ...flashRequest, count: 1, questionTypes: 'true_false' };

  it('validates true/false questions against the requested type', async () => {
    const mcq = {
      quizTitle: 'Cells',
      questions: [{ type: 'multiple_choice', question: 'Q?', options: ['A', 'B', 'C', 'D'], correctAnswerIndex: 0, explanation: 'E', sourceQuote: null }],
    };
    const tf = {
      quizTitle: 'Cells',
      questions: [{ type: 'true_false', question: 'Cells have DNA.', options: ['True', 'False'], correctAnswerIndex: 0, explanation: 'Yes.', sourceQuote: null }],
    };
    const provider = scriptedProvider([mcq, tf]);
    const out = await generateQuiz(provider, quizRequest, { maxAttempts: 2 });
    expect(out.result.questions[0]).toMatchObject({ type: 'true_false', options: ['True', 'False'] });
    expect(provider.prompts[0]).toContain('All questions must be true/false.');
    expect(provider.prompts[1]).toContain('must be true/false');
  });
});
