import { ValidationError } from '@/data/errors';
import {
  computeScore,
  decodeQuizAnswer,
  encodeQuizAnswer,
  gradeFlashcard,
  gradeQuizAnswer,
  seededRandom,
  shuffled,
} from '@/study/scoring';

const question = { options: ['Lungs', 'Liver', 'Heart', 'Kidneys'], correctAnswerIndex: 2 };
const items = ['a', 'b', 'c', 'd'];

describe('grading', () => {
  it('grades flashcard self-assessment', () => {
    expect(gradeFlashcard('know')).toBe(true);
    expect(gradeFlashcard('review')).toBe(false);
    expect(() => gradeFlashcard('maybe')).toThrow(ValidationError);
  });

  it('grades quiz answers by option index', () => {
    expect(gradeQuizAnswer(question, encodeQuizAnswer(2))).toBe(true);
    expect(gradeQuizAnswer(question, '0')).toBe(false);
    expect(gradeQuizAnswer({ options: ['True', 'False'], correctAnswerIndex: 1 }, '1')).toBe(true);
  });

  it.each(['', '-1', '1.5', '4', 'Heart', ' 2'])('rejects malformed quiz answer %j', (answer) => {
    expect(() => decodeQuizAnswer(answer, 4)).toThrow(ValidationError);
  });
});

describe('computeScore', () => {
  it('handles an empty session', () => {
    expect(computeScore([], [])).toEqual({
      total: 0,
      answered: 0,
      correct: 0,
      incorrect: 0,
      unanswered: 0,
      percent: null,
      perfect: false,
    });
  });

  it('counts unanswered items against a partial session', () => {
    const score = computeScore(items, [
      { itemId: 'a', isCorrect: true },
      { itemId: 'b', isCorrect: false },
    ]);
    expect(score).toMatchObject({ total: 4, answered: 2, correct: 1, incorrect: 1, unanswered: 2, percent: 25, perfect: false });
  });

  it('recognises a perfect score', () => {
    const score = computeScore(
      items,
      items.map((itemId) => ({ itemId, isCorrect: true })),
    );
    expect(score).toMatchObject({ correct: 4, percent: 100, perfect: true });
  });

  it('scores all-incorrect answers as zero', () => {
    const score = computeScore(
      items,
      items.map((itemId) => ({ itemId, isCorrect: false })),
    );
    expect(score).toMatchObject({ answered: 4, correct: 0, incorrect: 4, percent: 0, perfect: false });
  });

  it('ignores repeat answers and attempts for other items', () => {
    const score = computeScore(['a', 'b', 'c'], [
      { itemId: 'a', isCorrect: false },
      { itemId: 'a', isCorrect: true },
      { itemId: 'zzz', isCorrect: true },
      { itemId: 'b', isCorrect: true },
    ]);
    expect(score).toMatchObject({ answered: 2, correct: 1, percent: 33 });
  });
});

describe('shuffling', () => {
  it('is reproducible with a seed and keeps every item', () => {
    const ids = ['1', '2', '3', '4', '5', '6', '7', '8'];
    const first = shuffled(ids, seededRandom(42));
    expect(shuffled(ids, seededRandom(42))).toEqual(first);
    expect([...first].sort()).toEqual(ids);
    expect(first).not.toEqual(ids);
    expect(ids).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']); // input untouched
  });
});
