// Raster artwork used by the screens. See docs/ASSET_MANIFEST.md for sources and sizes.
import deckSuccess from '@/assets/illustrations/deck-success.png';
import emptyDecks from '@/assets/illustrations/empty-decks.png';
import onboarding from '@/assets/illustrations/onboarding.png';
// Feature tiles cut from the Task 0 reference sheet (small, so shown small).
import flashcardsTile from '@/assets/images/reference/tile-flashcards.png';
import progressTile from '@/assets/images/reference/tile-progress.png';
import quizzesTile from '@/assets/images/reference/tile-quizzes.png';

export const artwork = {
  onboarding: { source: onboarding, aspectRatio: 1 },
  emptyDecks: { source: emptyDecks, aspectRatio: 4 / 3 },
  deckSuccess: { source: deckSuccess, aspectRatio: 4 / 3 },
  flashcards: flashcardsTile,
  quizzes: quizzesTile,
  progress: progressTile,
} as const;
