import { STUDY_FEATURES } from '@/features/catalog';

describe('study feature catalog', () => {
  it('lists flashcards, quizzes and progress once each', () => {
    const ids = STUDY_FEATURES.map((f) => f.id);
    expect(ids).toEqual(['flashcards', 'quizzes', 'progress']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not claim any feature is available before it is built', () => {
    expect(STUDY_FEATURES.every((f) => f.status === 'planned')).toBe(true);
  });
});
