/**
 * Pure grading and scoring. No I/O, no clock, no randomness unless passed in,
 * so every result is reproducible in tests.
 */
import { ValidationError } from '@/data/errors';

export const STUDY_MODES = ['flashcards', 'quiz'] as const;
export type StudyMode = (typeof STUDY_MODES)[number];

/** Flashcard self-assessment: "Know it" counts as correct, "Review again" does not. */
export const FLASHCARD_ANSWERS = { know: 'know', review: 'review' } as const;
export type FlashcardAnswer = (typeof FLASHCARD_ANSWERS)[keyof typeof FLASHCARD_ANSWERS];

export function gradeFlashcard(answer: string): boolean {
  if (answer === FLASHCARD_ANSWERS.know) return true;
  if (answer === FLASHCARD_ANSWERS.review) return false;
  throw new ValidationError({ answer: 'Choose "Know it" or "Review again".' });
}

/** Quiz answers are stored as the chosen option's index, e.g. "2". */
export function encodeQuizAnswer(optionIndex: number): string {
  return String(optionIndex);
}

export function decodeQuizAnswer(answer: string, optionCount: number): number {
  if (!/^\d+$/.test(answer)) throw new ValidationError({ answer: 'Choose one of the options.' });
  const index = Number(answer);
  if (index >= optionCount) throw new ValidationError({ answer: 'Choose one of the options.' });
  return index;
}

export function gradeQuizAnswer(question: { options: string[]; correctAnswerIndex: number }, answer: string): boolean {
  return decodeQuizAnswer(answer, question.options.length) === question.correctAnswerIndex;
}

export type ScoredAttempt = { itemId: string; isCorrect: boolean };

export type Score = {
  /** Items in the session. */
  total: number;
  answered: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  /** Whole-number percentage of `total`; null for an empty session. */
  percent: number | null;
  perfect: boolean;
};

/**
 * Score from saved attempts. Unanswered items count against the total, attempts for
 * items outside the session are ignored, and only the first attempt per item counts.
 */
export function computeScore(itemIds: readonly string[], attempts: readonly ScoredAttempt[]): Score {
  const inSession = new Set(itemIds);
  const seen = new Set<string>();
  let correct = 0;
  let answered = 0;
  for (const attempt of attempts) {
    if (!inSession.has(attempt.itemId) || seen.has(attempt.itemId)) continue;
    seen.add(attempt.itemId);
    answered += 1;
    if (attempt.isCorrect) correct += 1;
  }
  const total = inSession.size;
  return {
    total,
    answered,
    correct,
    incorrect: answered - correct,
    unanswered: total - answered,
    percent: total === 0 ? null : Math.round((correct / total) * 100),
    perfect: total > 0 && correct === total,
  };
}

/** Deterministic PRNG (mulberry32) so shuffles can be reproduced in tests. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle into a new array; `random` returns [0, 1). */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
