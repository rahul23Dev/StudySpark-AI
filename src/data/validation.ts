import { ValidationError } from './errors';
import {
  DECK_SOURCES,
  DIFFICULTIES,
  QUESTION_TYPES,
  type DeckInput,
  type DeckSource,
  type Difficulty,
  type FlashcardInput,
  type QuestionType,
  type QuizQuestionInput,
} from './types';

/** Field limits. The SQL CHECK constraints in migrations.ts enforce the same numbers. */
export const LIMITS = {
  deckTitle: 80,
  deckDescription: 500,
  deckSubject: 60,
  cardFront: 1000,
  cardBack: 2000,
  question: 500,
  option: 300,
  explanation: 1000,
  minOptions: 2,
  maxOptions: 6,
} as const;

type Issues = Record<string, string>;

function text(
  issues: Issues,
  field: string,
  value: unknown,
  { label, max, required }: { label: string; max: number; required: boolean },
): string {
  if (value === undefined || value === null) {
    if (required) issues[field] = `${label} is required.`;
    return '';
  }
  if (typeof value !== 'string') {
    issues[field] = `${label} must be text.`;
    return '';
  }
  const trimmed = value.trim();
  if (required && trimmed.length === 0) issues[field] = `${label} is required.`;
  else if (trimmed.length > max) issues[field] = `${label} must be ${max} characters or fewer.`;
  return trimmed;
}

function oneOf<T extends string>(issues: Issues, field: string, value: unknown, allowed: readonly T[], fallback: T): T {
  if (value === undefined) return fallback;
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T;
  issues[field] = `Must be one of: ${allowed.join(', ')}.`;
  return fallback;
}

function finish<T>(issues: Issues, value: T): T {
  if (Object.keys(issues).length > 0) throw new ValidationError(issues);
  return value;
}

export type ValidDeck = { title: string; description: string; subject: string; source: DeckSource };

export function validateDeckInput(input: DeckInput): ValidDeck {
  const issues: Issues = {};
  return finish(issues, {
    title: text(issues, 'title', input.title, { label: 'Title', max: LIMITS.deckTitle, required: true }),
    description: text(issues, 'description', input.description, {
      label: 'Description',
      max: LIMITS.deckDescription,
      required: false,
    }),
    subject: text(issues, 'subject', input.subject, { label: 'Subject', max: LIMITS.deckSubject, required: false }),
    source: oneOf(issues, 'source', input.source, DECK_SOURCES, 'manual'),
  });
}

export type ValidFlashcard = { front: string; back: string; difficulty: Difficulty };

export function validateFlashcardInput(input: FlashcardInput): ValidFlashcard {
  const issues: Issues = {};
  return finish(issues, {
    front: text(issues, 'front', input.front, { label: 'Front', max: LIMITS.cardFront, required: true }),
    back: text(issues, 'back', input.back, { label: 'Back', max: LIMITS.cardBack, required: true }),
    difficulty: oneOf(issues, 'difficulty', input.difficulty, DIFFICULTIES, 'medium'),
  });
}

export type ValidQuizQuestion = {
  type: QuestionType;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
};

export function validateQuizQuestionInput(input: QuizQuestionInput): ValidQuizQuestion {
  const issues: Issues = {};
  const type = oneOf(issues, 'type', input.type, QUESTION_TYPES, 'multiple_choice');
  const question = text(issues, 'question', input.question, { label: 'Question', max: LIMITS.question, required: true });
  const explanation = text(issues, 'explanation', input.explanation, {
    label: 'Explanation',
    max: LIMITS.explanation,
    required: false,
  });

  let options: string[] = [];
  if (!Array.isArray(input.options)) {
    issues.options = 'Options must be a list.';
  } else {
    options = input.options.map((option, i) =>
      text(issues, `options.${i}`, option, { label: `Option ${i + 1}`, max: LIMITS.option, required: true }),
    );
    const [min, max] = type === 'true_false' ? [2, 2] : [LIMITS.minOptions, LIMITS.maxOptions];
    if (options.length < min || options.length > max) {
      issues.options =
        min === max ? `True/false questions need exactly ${min} options.` : `Add between ${min} and ${max} options.`;
    } else if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
      issues.options = 'Options must be different from each other.';
    }
  }

  const index = input.correctAnswerIndex;
  if (!Number.isInteger(index) || index < 0 || index >= options.length) {
    issues.correctAnswerIndex = 'Choose which option is correct.';
  }

  return finish(issues, { type, question, options, correctAnswerIndex: index, explanation });
}
