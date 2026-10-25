/** @jest-environment node */
import type { FlashcardGeneration, QuizGeneration } from '@/ai/client';
import { deckFromGeneration } from '@/ai/to-deck';
import { ValidationError } from '@/data/errors';

import { openTestRepository } from '../../test/node-sqlite';

const meta = { requestId: 'r', model: 'claude-opus-5-5', attempts: 1, usage: { inputTokens: 1, outputTokens: 1 } };

const flashGen: FlashcardGeneration = {
  kind: 'flashcards',
  aiGenerated: true,
  deck: {
    title: 'Cells',
    cards: [
      { question: 'What is a cell?', answer: 'Unit of life', difficulty: 'easy' },
      { question: 'What carries genes?', answer: 'DNA', difficulty: 'medium', sourceQuote: 'DNA carries genes' },
    ],
  },
  meta,
};

const quizGen: QuizGeneration = {
  kind: 'quiz',
  aiGenerated: true,
  quiz: {
    title: 'Body quiz',
    questions: [
      { type: 'multiple_choice', question: 'Pumps blood?', options: ['Lungs', 'Liver', 'Heart', 'Kidneys'], correctAnswerIndex: 2, explanation: 'The heart.' },
      { type: 'true_false', question: 'Bones are alive.', options: ['True', 'False'], correctAnswerIndex: 0, explanation: 'They grow.' },
    ],
  },
  meta,
};

describe('saving AI content as a deck', () => {
  it('saves a generated flashcard deck in one go, marked as AI, keeping grounded sources', async () => {
    const { repo } = await openTestRepository();
    const deck = await repo.createDeckWithContent(deckFromGeneration(flashGen, { type: 'topic', topic: 'Cells' }, 'My cells'));
    expect(deck).toMatchObject({ title: 'My cells', source: 'ai', description: 'Created with AI about “Cells”.' });
    const cards = await repo.listFlashcards(deck.id);
    expect(cards.map((c) => [c.front, c.back, c.difficulty, c.position])).toEqual([
      ['What is a cell?', 'Unit of life', 'easy', 0],
      ['What carries genes?', 'DNA\n\nSource: “DNA carries genes”', 'medium', 1],
    ]);
  });

  it('saves a generated quiz as a deck of questions', async () => {
    const { repo } = await openTestRepository();
    const deck = await repo.createDeckWithContent(deckFromGeneration(quizGen, { type: 'notes', notes: 'x'.repeat(50) }, 'Body quiz'));
    expect(deck.description).toBe('Created with AI from your notes.');
    expect((await repo.listQuizQuestions(deck.id)).map((q) => [q.question, q.correctAnswerIndex])).toEqual([
      ['Pumps blood?', 2],
      ['Bones are alive.', 0],
    ]);
  });

  it('saves nothing when any item is invalid, and existing decks survive', async () => {
    const { repo } = await openTestRepository();
    const existing = await repo.createDeck({ title: 'My own deck' });
    await repo.createFlashcard(existing.id, { front: 'Keep me', back: 'Please' });

    const content = deckFromGeneration(flashGen, { type: 'topic', topic: 'Cells' }, 'Broken');
    content.cards.push({ front: '   ', back: 'no question' });
    const error = await repo.createDeckWithContent(content).catch((e) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect(Object.keys(error.issues)).toEqual(['cards.2.front']);

    expect((await repo.listDecks()).map((d) => d.title)).toEqual(['My own deck']);
    expect((await repo.listFlashcards(existing.id)).map((c) => c.front)).toEqual(['Keep me']);
  });

  it('rolls back completely when a write fails part-way', async () => {
    const { db, repo } = await openTestRepository();
    await repo.createDeck({ title: 'Existing' });
    const realRun = db.runAsync.bind(db);
    let inserts = 0;
    jest.spyOn(db, 'runAsync').mockImplementation(async (sql, params) => {
      if (sql.includes('INSERT INTO flashcards') && ++inserts === 2) throw new Error('disk full');
      return realRun(sql, params);
    });
    await expect(
      repo.createDeckWithContent(deckFromGeneration(flashGen, { type: 'topic', topic: 'Cells' }, 'Half saved?')),
    ).rejects.toThrow('disk full');
    jest.restoreAllMocks();
    expect((await repo.listDecks()).map((d) => d.title)).toEqual(['Existing']);
    expect((await repo.getStats()).cardCount).toBe(0);
  });
});
