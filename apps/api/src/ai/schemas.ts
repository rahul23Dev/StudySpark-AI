/**
 * Request and output schemas (Zod), plus the content checks JSON Schema can't express:
 * exact counts, duplicates, option rules, answer index, length limits and grounding.
 * Limits stay within the mobile app's database limits (apps -> src/data/validation.ts).
 */
import { z } from 'zod';

export const LIMITS = {
  topic: { min: 2, max: 200 },
  notes: { min: 40, max: 20_000 },
  language: { min: 2, max: 40 },
  title: 80,
  flashcards: { min: 1, max: 30 },
  quiz: { min: 1, max: 20 },
  question: 300,
  answer: 600,
  option: 150,
  explanation: 500,
  sourceQuote: 300,
  mcqOptions: 4,
} as const;

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

// ---------- Requests ----------

const source = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('topic'),
    topic: z.string().trim().min(LIMITS.topic.min).max(LIMITS.topic.max),
  }),
  z.object({
    type: z.literal('notes'),
    notes: z.string().trim().min(LIMITS.notes.min).max(LIMITS.notes.max),
  }),
]);

const common = {
  source,
  difficulty: z.enum(DIFFICULTIES),
  language: z.string().trim().min(LIMITS.language.min).max(LIMITS.language.max).default('English'),
};

export const FlashcardRequestSchema = z.strictObject({
  ...common,
  count: z.number().int().min(LIMITS.flashcards.min).max(LIMITS.flashcards.max),
});
export type FlashcardRequest = z.infer<typeof FlashcardRequestSchema>;

export const QUIZ_TYPES = ['multiple_choice', 'true_false', 'mixed'] as const;
export const QuizRequestSchema = z.strictObject({
  ...common,
  count: z.number().int().min(LIMITS.quiz.min).max(LIMITS.quiz.max),
  questionTypes: z.enum(QUIZ_TYPES).default('mixed'),
});
export type QuizRequest = z.infer<typeof QuizRequestSchema>;

// ---------- Model output (sent to the provider as the structured-output format) ----------

export const FlashcardModelOutputSchema = z.object({
  deckTitle: z.string(),
  cards: z.array(
    z.object({
      question: z.string(),
      answer: z.string(),
      difficulty: z.enum(DIFFICULTIES),
      /** A short verbatim quote from the provided notes, or null. */
      sourceQuote: z.string().nullable(),
    }),
  ),
});
export type FlashcardModelOutput = z.infer<typeof FlashcardModelOutputSchema>;

export const QuizModelOutputSchema = z.object({
  quizTitle: z.string(),
  questions: z.array(
    z.object({
      type: z.enum(['multiple_choice', 'true_false']),
      question: z.string(),
      options: z.array(z.string()),
      correctAnswerIndex: z.number().int(),
      explanation: z.string(),
      sourceQuote: z.string().nullable(),
    }),
  ),
});
export type QuizModelOutput = z.infer<typeof QuizModelOutputSchema>;

// ---------- Validated results returned to the app ----------

export type GeneratedFlashcard = {
  question: string;
  answer: string;
  difficulty: Difficulty;
  /** Present only when grounded: a quote found verbatim in the user's notes. */
  sourceQuote?: string;
};
export type GeneratedDeck = { title: string; cards: GeneratedFlashcard[] };

export type GeneratedQuestion = {
  type: 'multiple_choice' | 'true_false';
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  sourceQuote?: string;
};
export type GeneratedQuiz = { title: string; questions: GeneratedQuestion[] };

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; issues: string[] };

// ---------- Content checks ----------

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').replace(/[^\p{L}\p{N} ]/gu, '').trim();

/** Keeps a source quote only if it really appears in the notes (whitespace/case-insensitive). */
export function groundedQuote(quote: string | null | undefined, notes: string | null): string | undefined {
  if (!quote || !notes) return undefined;
  const q = quote.trim();
  if (q.length < 8 || q.length > LIMITS.sourceQuote) return undefined;
  const haystack = notes.toLowerCase().replace(/\s+/g, ' ');
  return haystack.includes(q.toLowerCase().replace(/\s+/g, ' ')) ? q : undefined;
}

function text(issues: string[], label: string, value: string, max: number): string {
  const t = value.trim();
  if (!t) issues.push(`${label} is empty.`);
  else if (t.length > max) issues.push(`${label} is longer than ${max} characters.`);
  return t;
}

export type CheckOptions = {
  requestedCount: number;
  /** The user's notes when generating from notes; null for a topic. */
  notes: string | null;
  /** Last attempt: trim surplus items instead of rejecting. */
  final: boolean;
};

export function checkFlashcards(output: FlashcardModelOutput, opts: CheckOptions): ValidationResult<GeneratedDeck> {
  const issues: string[] = [];
  const title = text(issues, 'Deck title', output.deckTitle, LIMITS.title);
  const seen = new Set<string>();
  const cards: GeneratedFlashcard[] = [];
  output.cards.forEach((card, i) => {
    const n = i + 1;
    const cardIssues: string[] = [];
    const question = text(cardIssues, `Card ${n} question`, card.question, LIMITS.question);
    const answer = text(cardIssues, `Card ${n} answer`, card.answer, LIMITS.answer);
    const key = normalize(question);
    if (key && seen.has(key)) cardIssues.push(`Card ${n} duplicates an earlier question.`);
    if (cardIssues.length) {
      issues.push(...cardIssues);
      return;
    }
    seen.add(key);
    const quote = groundedQuote(card.sourceQuote, opts.notes);
    cards.push({ question, answer, difficulty: card.difficulty, ...(quote ? { sourceQuote: quote } : {}) });
  });
  return finishCount(issues, cards, opts, 'cards', (items) => ({ title, cards: items }));
}

export function checkQuiz(
  output: QuizModelOutput,
  opts: CheckOptions & { questionTypes: QuizRequest['questionTypes'] },
): ValidationResult<GeneratedQuiz> {
  const issues: string[] = [];
  const title = text(issues, 'Quiz title', output.quizTitle, LIMITS.title);
  const seen = new Set<string>();
  const questions: GeneratedQuestion[] = [];
  output.questions.forEach((q, i) => {
    const n = i + 1;
    const qIssues: string[] = [];
    const question = text(qIssues, `Question ${n}`, q.question, LIMITS.question);
    const explanation = text(qIssues, `Question ${n} explanation`, q.explanation, LIMITS.explanation);
    if (opts.questionTypes !== 'mixed' && q.type !== opts.questionTypes) {
      qIssues.push(`Question ${n} must be ${opts.questionTypes === 'true_false' ? 'true/false' : 'multiple choice'}.`);
    }
    let options = q.options.map((o, j) => text(qIssues, `Question ${n} option ${j + 1}`, o, LIMITS.option));
    let correct = q.correctAnswerIndex;
    if (q.type === 'true_false') {
      // Accept any casing, store canonically as ["True", "False"].
      const lowered = options.map((o) => o.toLowerCase());
      if (lowered.length === 2 && lowered[0] === 'false' && lowered[1] === 'true') {
        options = ['True', 'False'];
        correct = correct === 0 ? 1 : correct === 1 ? 0 : correct;
      } else if (lowered.length === 2 && lowered[0] === 'true' && lowered[1] === 'false') {
        options = ['True', 'False'];
      } else {
        qIssues.push(`Question ${n} is true/false, so its options must be exactly "True" and "False".`);
      }
    } else if (options.length !== LIMITS.mcqOptions) {
      qIssues.push(`Question ${n} needs exactly ${LIMITS.mcqOptions} options (it has ${options.length}).`);
    }
    if (new Set(options.map(normalize)).size !== options.length) qIssues.push(`Question ${n} has duplicate options.`);
    if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) {
      qIssues.push(`Question ${n} has an invalid correctAnswerIndex (${q.correctAnswerIndex}).`);
    }
    const key = normalize(question);
    if (key && seen.has(key)) qIssues.push(`Question ${n} duplicates an earlier question.`);
    if (qIssues.length) {
      issues.push(...qIssues);
      return;
    }
    seen.add(key);
    const quote = groundedQuote(q.sourceQuote, opts.notes);
    questions.push({
      type: q.type,
      question,
      options,
      correctAnswerIndex: correct,
      explanation,
      ...(quote ? { sourceQuote: quote } : {}),
    });
  });
  return finishCount(issues, questions, opts, 'questions', (items) => ({ title, questions: items }));
}

/**
 * Item-level problems drop that item. The result is accepted only with exactly the
 * requested number of good items; on the final attempt a surplus is trimmed, but a
 * shortfall is still rejected (never padded with made-up content).
 */
function finishCount<I, T>(
  issues: string[],
  items: I[],
  opts: CheckOptions,
  noun: string,
  build: (items: I[]) => T,
): ValidationResult<T> {
  const titleProblem = issues.find((i) => i.includes('title'));
  if (titleProblem) return { ok: false, issues };
  if (items.length === opts.requestedCount) return { ok: true, value: build(items) };
  if (items.length > opts.requestedCount && opts.final) {
    return { ok: true, value: build(items.slice(0, opts.requestedCount)) };
  }
  return {
    ok: false,
    issues: [...issues, `Expected exactly ${opts.requestedCount} valid ${noun}, got ${items.length}.`],
  };
}
