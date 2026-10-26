import { STUDY_FEATURES } from '@/features/catalog';

describe('study feature catalog', () => {
  it('lists flashcards, quizzes and progress once each', () => {
    const ids = STUDY_FEATURES.map((f) => f.id);
    expect(ids).toEqual(['flashcards', 'quizzes', 'progress']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('marks flashcards, quizzes and progress available now they are built', () => {
    expect(STUDY_FEATURES.every((f) => f.status === 'available')).toBe(true);
  });
});
