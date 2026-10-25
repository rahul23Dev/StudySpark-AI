// Raster artwork cut from the StudySpark visual reference sheet
// (scripts/crop-reference.mjs). The crops are small (roughly 100-160 px), so keep
// them at modest display sizes until higher-resolution originals exist.
import logoMark from '@/assets/images/reference/logo-mark.png';
import books from '@/assets/images/reference/illustration-books.png';
import robotReading from '@/assets/images/reference/illustration-robot-reading.png';
import flashcardsTile from '@/assets/images/reference/tile-flashcards.png';
import progressTile from '@/assets/images/reference/tile-progress.png';
import quizzesTile from '@/assets/images/reference/tile-quizzes.png';

export const artwork = {
  logoMark,
  onboarding: { source: robotReading, aspectRatio: 156 / 124 },
  emptyState: { source: books, aspectRatio: 128 / 124 },
  flashcards: flashcardsTile,
  quizzes: quizzesTile,
  progress: progressTile,
} as const;
