/**
 * Generation pipeline: provider call -> schema-shaped data -> content checks.
 * When the output fails the checks (or is unusable), the request is retried with the
 * problems listed, up to `maxAttempts`. Token usage is summed across attempts, and
 * failed attempts are counted too.
 */
import { InvalidModelOutputError } from '@/errors';

import {
  FLASHCARD_SYSTEM_PROMPT,
  QUIZ_SYSTEM_PROMPT,
  correctionNote,
  flashcardUserPrompt,
  quizUserPrompt,
} from './prompts';
import { UnusableOutputError, usageOf, type AiProvider, type TokenUsage } from './provider';
import {
  FlashcardModelOutputSchema,
  QuizModelOutputSchema,
  checkFlashcards,
  checkQuiz,
  type FlashcardRequest,
  type GeneratedDeck,
  type GeneratedQuiz,
  type QuizRequest,
  type ValidationResult,
} from './schemas';
import type { z } from 'zod';

export type GenerationMeta = { model: string; attempts: number; usage: TokenUsage };
export type Generated<T> = { result: T; meta: GenerationMeta };

const addUsage = (a: TokenUsage, b: TokenUsage | null): TokenUsage =>
  b ? { inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens } : a;

/** Error carrying the usage spent before it, so callers can still meter it. */
function withUsage<E extends Error>(error: E, usage: TokenUsage): E & { usage: TokenUsage } {
  return Object.assign(error, { usage });
}

async function generateChecked<O, T>(args: {
  provider: AiProvider;
  system: string;
  prompt: string;
  schema: z.ZodType<O>;
  check: (output: O, final: boolean) => ValidationResult<T>;
  maxAttempts: number;
  signal?: AbortSignal;
}): Promise<Generated<T>> {
  let usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  let issues: string[] = [];
  let model = args.provider.model;
  for (let attempt = 1; attempt <= args.maxAttempts; attempt += 1) {
    const final = attempt === args.maxAttempts;
    const prompt = issues.length ? `${args.prompt}\n\n${correctionNote(issues)}` : args.prompt;
    let output: O;
    try {
      const res = await args.provider.generateStructured({
        system: args.system,
        prompt,
        schema: args.schema,
        signal: args.signal,
      });
      usage = addUsage(usage, res.usage);
      model = res.model;
      output = res.data;
    } catch (error) {
      usage = addUsage(usage, usageOf(error));
      if (error instanceof UnusableOutputError) {
        issues = [error.reason];
        continue;
      }
      throw withUsage(error instanceof Error ? error : new Error(String(error)), usage);
    }
    const checked = args.check(output, final);
    if (checked.ok) return { result: checked.value, meta: { model, attempts: attempt, usage } };
    issues = checked.issues;
  }
  throw withUsage(new InvalidModelOutputError(issues), usage);
}

export function generateFlashcards(
  provider: AiProvider,
  req: FlashcardRequest,
  opts: { maxAttempts: number; signal?: AbortSignal },
): Promise<Generated<GeneratedDeck>> {
  const notes = req.source.type === 'notes' ? req.source.notes : null;
  return generateChecked({
    provider,
    system: FLASHCARD_SYSTEM_PROMPT,
    prompt: flashcardUserPrompt(req),
    schema: FlashcardModelOutputSchema,
    check: (output, final) => checkFlashcards(output, { requestedCount: req.count, notes, final }),
    ...opts,
  });
}

export function generateQuiz(
  provider: AiProvider,
  req: QuizRequest,
  opts: { maxAttempts: number; signal?: AbortSignal },
): Promise<Generated<GeneratedQuiz>> {
  const notes = req.source.type === 'notes' ? req.source.notes : null;
  return generateChecked({
    provider,
    system: QUIZ_SYSTEM_PROMPT,
    prompt: quizUserPrompt(req),
    schema: QuizModelOutputSchema,
    check: (output, final) =>
      checkQuiz(output, { requestedCount: req.count, notes, final, questionTypes: req.questionTypes }),
    ...opts,
  });
}
