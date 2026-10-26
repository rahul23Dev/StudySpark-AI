// Raster artwork used by the screens. See docs/ASSET_MANIFEST.md for sources and sizes.
import aiCreate from '@/assets/illustrations/ai-create.png';
import deckSuccess from '@/assets/illustrations/deck-success.png';
import generationError from '@/assets/illustrations/generation-error.png';
import generationLoading from '@/assets/illustrations/generation-loading.png';
import emptyDecks from '@/assets/illustrations/empty-decks.png';
import flashcardEmpty from '@/assets/illustrations/flashcard-empty.png';
import progressGrowth from '@/assets/illustrations/progress-growth.png';
import revisionCalendar from '@/assets/illustrations/revision-calendar.png';
import streakCelebration from '@/assets/illustrations/streak-celebration.png';
import onboarding from '@/assets/illustrations/onboarding.png';
import quizComplete from '@/assets/illustrations/quiz-complete.png';
import studyCelebration from '@/assets/illustrations/study-celebration.png';
// Feature tiles cut from the Task 0 reference sheet (small, so shown small).
import flashcardsTile from '@/assets/images/reference/tile-flashcards.png';
import progressTile from '@/assets/images/reference/tile-progress.png';
import quizzesTile from '@/assets/images/reference/tile-quizzes.png';

const landscape = 4 / 3;

export const artwork = {
  onboarding: { source: onboarding, aspectRatio: 1 },
  emptyDecks: { source: emptyDecks, aspectRatio: landscape },
  deckSuccess: { source: deckSuccess, aspectRatio: landscape },
  flashcardEmpty: { source: flashcardEmpty, aspectRatio: landscape },
  quizComplete: { source: quizComplete, aspectRatio: landscape },
  studyCelebration: { source: studyCelebration, aspectRatio: landscape },
  aiCreate: { source: aiCreate, aspectRatio: landscape },
  generationLoading: { source: generationLoading, aspectRatio: landscape },
  generationError: { source: generationError, aspectRatio: landscape },
  progressGrowth: { source: progressGrowth, aspectRatio: landscape },
  streakCelebration: { source: streakCelebration, aspectRatio: landscape },
  revisionCalendar: { source: revisionCalendar, aspectRatio: landscape },
  flashcards: flashcardsTile,
  quizzes: quizzesTile,
  progress: progressTile,
} as const;
