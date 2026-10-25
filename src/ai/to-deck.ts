/** Turns a validated AI generation into input for repository.createDeckWithContent. */
import type { DeckInput, FlashcardInput, QuizQuestionInput } from '@/data/types';

import type { FlashcardGeneration, GenerationSource, QuizGeneration } from './client';

/** A grounded quote from the user's notes is kept with the card, so learners can check it. */
const withSource = (text: string, quote?: string) => (quote ? `${text}\n\nSource: “${quote}”` : text);

function describe(source: GenerationSource): string {
  return source.type === 'notes' ? 'Created with AI from your notes.' : `Created with AI about “${source.topic}”.`;
}

export function deckFromGeneration(
  generation: FlashcardGeneration | QuizGeneration,
  source: GenerationSource,
  title: string,
): { deck: DeckInput; cards: FlashcardInput[]; questions: QuizQuestionInput[] } {
  const deck: DeckInput = { title, description: describe(source), subject: '', source: 'ai' };
  if (generation.kind === 'flashcards') {
    return {
      deck,
      cards: generation.deck.cards.map((c) => ({
        front: c.question,
        back: withSource(c.answer, c.sourceQuote),
        difficulty: c.difficulty,
      })),
      questions: [],
    };
  }
  return {
    deck,
    cards: [],
    questions: generation.quiz.questions.map((q) => ({
      type: q.type,
      question: q.question,
      options: q.options,
      correctAnswerIndex: q.correctAnswerIndex,
      explanation: withSource(q.explanation, q.sourceQuote),
    })),
  };
}
