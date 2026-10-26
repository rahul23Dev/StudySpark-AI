/**
 * The study tools StudySpark AI offers. A tool stays "planned" until it is actually
 * built — the UI must never present an unbuilt feature as working.
 */
export type FeatureStatus = 'planned' | 'available';

export type StudyFeatureId = 'flashcards' | 'quizzes' | 'progress';

export type StudyFeature = {
  id: StudyFeatureId;
  title: string;
  description: string;
  status: FeatureStatus;
};

export const STUDY_FEATURES: readonly StudyFeature[] = [
  {
    id: 'flashcards',
    title: 'Flashcards',
    description: 'Turn your notes into cards and review them at the right moment.',
    status: 'available',
  },
  {
    id: 'quizzes',
    title: 'Quizzes',
    description: 'Check what you know with short practice quizzes.',
    status: 'available',
  },
  {
    id: 'progress',
    title: 'Study progress',
    description: 'See your daily goal, streak and the cards due for review.',
    status: 'available',
  },
];
