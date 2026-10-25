export const DECK_SOURCES = ['manual', 'duplicate', 'import', 'ai'] as const;
export type DeckSource = (typeof DECK_SOURCES)[number];

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const QUESTION_TYPES = ['multiple_choice', 'true_false'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** ISO-8601 UTC timestamp, e.g. "2026-10-25T17:03:00.000Z". */
export type Timestamp = string;

export type Deck = {
  id: string;
  title: string;
  description: string;
  subject: string;
  source: DeckSource;
  /** Manual ("My order") position, 0-based. */
  position: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type DeckSummary = Deck & { cardCount: number };

export type Flashcard = {
  id: string;
  deckId: string;
  front: string;
  back: string;
  difficulty: Difficulty;
  /** 0-based and contiguous within a deck. */
  position: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type QuizQuestion = {
  id: string;
  deckId: string;
  type: QuestionType;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  position: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type DeckInput = {
  title: string;
  description?: string;
  subject?: string;
  source?: DeckSource;
};

export type FlashcardInput = {
  front: string;
  back: string;
  difficulty?: Difficulty;
};

export type QuizQuestionInput = {
  type: QuestionType;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation?: string;
};

export const DECK_SORTS = ['updated', 'created', 'title', 'custom'] as const;
export type DeckSort = (typeof DECK_SORTS)[number];
