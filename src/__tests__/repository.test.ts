/** @jest-environment node */
import { NotFoundError, ValidationError } from '@/data/errors';

import { openTestRepository } from '../../test/node-sqlite';

async function setup() {
  return openTestRepository();
}

describe('decks', () => {
  it('creates a deck with a UUID, trimmed fields, timestamps and a position', async () => {
    const { repo } = await setup();
    const deck = await repo.createDeck({ title: '  Biology  ', subject: ' Science ', description: 'Cells' });
    expect(deck).toMatchObject({ title: 'Biology', subject: 'Science', description: 'Cells', source: 'manual', position: 0 });
    expect(deck.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(deck.createdAt).toBe(deck.updatedAt);
    expect((await repo.createDeck({ title: 'Second' })).position).toBe(1);
  });

  it('rejects invalid decks before touching the database', async () => {
    const { repo } = await setup();
    await expect(repo.createDeck({ title: '   ' })).rejects.toBeInstanceOf(ValidationError);
    await expect(repo.createDeck({ title: 'x'.repeat(81) })).rejects.toMatchObject({ issues: { title: expect.any(String) } });
    // Runtime data from outside TypeScript (e.g. a future import) is checked too.
    await expect(repo.createDeck({ title: 'Ok', source: 'hacked' as never })).rejects.toMatchObject({
      issues: { source: expect.any(String) },
    });
    expect(await repo.listDecks()).toEqual([]);
  });

  it('renames and edits, bumping updatedAt only', async () => {
    const { repo } = await setup();
    const deck = await repo.createDeck({ title: 'Old', subject: 'Math' });
    const renamed = await repo.updateDeck(deck.id, { title: 'New' });
    expect(renamed).toMatchObject({ title: 'New', subject: 'Math', createdAt: deck.createdAt });
    expect(renamed.updatedAt > deck.updatedAt).toBe(true);
    await expect(repo.updateDeck(deck.id, { title: '' })).rejects.toBeInstanceOf(ValidationError);
    await expect(repo.updateDeck('missing', { title: 'x' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('searches title, subject and description, treating % and _ literally', async () => {
    const { repo } = await setup();
    await repo.createDeck({ title: 'Cell biology', subject: 'Science' });
    await repo.createDeck({ title: 'French verbs', subject: 'Languages', description: 'être, avoir' });
    await repo.createDeck({ title: '100% chemistry' });
    const titles = async (search: string) => (await repo.listDecks({ search, sort: 'title' })).map((d) => d.title);
    expect(await titles('BIO')).toEqual(['Cell biology']);
    expect(await titles('languages')).toEqual(['French verbs']);
    expect(await titles('avoir')).toEqual(['French verbs']);
    expect(await titles('%')).toEqual(['100% chemistry']);
    expect(await titles('_')).toEqual([]);
    expect(await titles('  ')).toHaveLength(3);
  });

  it('sorts by updated, created, title and manual order', async () => {
    const { repo } = await setup();
    const a = await repo.createDeck({ title: 'banana' });
    const b = await repo.createDeck({ title: 'Apple' });
    const c = await repo.createDeck({ title: 'cherry' });
    await repo.updateDeck(a.id, { description: 'touched last' });
    const order = async (sort: 'updated' | 'created' | 'title' | 'custom') =>
      (await repo.listDecks({ sort })).map((d) => d.title);
    expect(await order('updated')).toEqual(['banana', 'cherry', 'Apple']);
    expect(await order('created')).toEqual(['cherry', 'Apple', 'banana']);
    expect(await order('title')).toEqual(['Apple', 'banana', 'cherry']);
    expect(await order('custom')).toEqual(['banana', 'Apple', 'cherry']);

    await repo.reorderDecks([c.id, a.id, b.id]);
    expect(await order('custom')).toEqual(['cherry', 'banana', 'Apple']);
    await expect(repo.reorderDecks([a.id, b.id])).rejects.toBeInstanceOf(ValidationError);
    await expect(repo.listDecks({ sort: 'DROP TABLE decks' as never })).rejects.toBeInstanceOf(ValidationError);
  });

  it('reports card counts and totals', async () => {
    const { repo } = await setup();
    const deck = await repo.createDeck({ title: 'Counted' });
    await repo.createDeck({ title: 'Empty' });
    await repo.createFlashcard(deck.id, { front: 'Q1', back: 'A1' });
    await repo.createFlashcard(deck.id, { front: 'Q2', back: 'A2' });
    const list = await repo.listDecks({ sort: 'title' });
    expect(list.map((d) => [d.title, d.cardCount])).toEqual([
      ['Counted', 2],
      ['Empty', 0],
    ]);
    expect(await repo.getStats()).toEqual({ deckCount: 2, cardCount: 2 });
  });

  it('duplicates a deck with its cards and quiz questions under new ids', async () => {
    const { repo } = await setup();
    const deck = await repo.createDeck({ title: 'Original', subject: 'History' });
    const card = await repo.createFlashcard(deck.id, { front: 'When?', back: '1066', difficulty: 'hard' });
    await repo.createQuizQuestion(deck.id, {
      type: 'multiple_choice',
      question: 'Who won?',
      options: ['William', 'Harold'],
      correctAnswerIndex: 0,
    });

    const copy = await repo.duplicateDeck(deck.id);
    expect(copy).toMatchObject({ title: 'Original (copy)', subject: 'History', source: 'duplicate' });
    expect(copy.id).not.toBe(deck.id);

    const cards = await repo.listFlashcards(copy.id);
    expect(cards).toEqual([expect.objectContaining({ front: 'When?', back: '1066', difficulty: 'hard', position: 0 })]);
    expect(cards[0].id).not.toBe(card.id);
    const questions = await repo.listQuizQuestions(copy.id);
    expect(questions).toEqual([expect.objectContaining({ question: 'Who won?', options: ['William', 'Harold'] })]);

    // Editing the copy leaves the original alone.
    await repo.updateFlashcard(cards[0].id, { back: 'Changed' });
    expect((await repo.listFlashcards(deck.id))[0].back).toBe('1066');
  });

  it('keeps duplicate titles within the length limit', async () => {
    const { repo } = await setup();
    const deck = await repo.createDeck({ title: 'x'.repeat(80) });
    const copy = await repo.duplicateDeck(deck.id);
    expect(copy.title).toHaveLength(80);
    expect(copy.title.endsWith(' (copy)')).toBe(true);
  });

  it('deletes a deck and cascades to cards, questions and options', async () => {
    const { db, repo } = await setup();
    const deck = await repo.createDeck({ title: 'Doomed' });
    const keep = await repo.createDeck({ title: 'Kept' });
    await repo.createFlashcard(deck.id, { front: 'a', back: 'b' });
    await repo.createFlashcard(keep.id, { front: 'c', back: 'd' });
    await repo.createQuizQuestion(deck.id, {
      type: 'true_false',
      question: 'Sky is blue?',
      options: ['True', 'False'],
      correctAnswerIndex: 0,
    });

    await repo.deleteDeck(deck.id);

    const count = (table: string) =>
      Number((db.raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n);
    expect(await repo.getDeck(deck.id)).toBeNull();
    expect(count('flashcards')).toBe(1);
    expect(count('quiz_questions')).toBe(0);
    expect(count('quiz_question_options')).toBe(0);
    await expect(repo.deleteDeck(deck.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('flashcards', () => {
  it('adds cards in order and touches the deck', async () => {
    const { repo } = await setup();
    const deck = await repo.createDeck({ title: 'Deck' });
    const one = await repo.createFlashcard(deck.id, { front: ' Front ', back: ' Back ' });
    const two = await repo.createFlashcard(deck.id, { front: 'F2', back: 'B2', difficulty: 'easy' });
    expect(one).toMatchObject({ front: 'Front', back: 'Back', difficulty: 'medium', position: 0, deckId: deck.id });
    expect(two.position).toBe(1);
    expect((await repo.getDeck(deck.id))!.updatedAt > deck.updatedAt).toBe(true);
  });

  it('rejects invalid cards and unknown decks', async () => {
    const { repo } = await setup();
    const deck = await repo.createDeck({ title: 'Deck' });
    await expect(repo.createFlashcard(deck.id, { front: '', back: 'b' })).rejects.toMatchObject({
      issues: { front: expect.any(String) },
    });
    await expect(repo.createFlashcard(deck.id, { front: 'f', back: 'b', difficulty: 'extreme' as never })).rejects.toMatchObject({
      issues: { difficulty: expect.any(String) },
    });
    await expect(repo.createFlashcard('no-such-deck', { front: 'f', back: 'b' })).rejects.toBeInstanceOf(NotFoundError);
    expect(await repo.listFlashcards(deck.id)).toEqual([]);
  });

  it('edits a card', async () => {
    const { repo } = await setup();
    const deck = await repo.createDeck({ title: 'Deck' });
    const card = await repo.createFlashcard(deck.id, { front: 'f', back: 'b' });
    const edited = await repo.updateFlashcard(card.id, { back: 'better', difficulty: 'hard' });
    expect(edited).toMatchObject({ front: 'f', back: 'better', difficulty: 'hard', createdAt: card.createdAt });
    await expect(repo.updateFlashcard(card.id, { back: ' ' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('moves cards and keeps positions contiguous after deletes', async () => {
    const { repo } = await setup();
    const deck = await repo.createDeck({ title: 'Deck' });
    const [a, b, c] = [
      await repo.createFlashcard(deck.id, { front: 'a', back: '1' }),
      await repo.createFlashcard(deck.id, { front: 'b', back: '2' }),
      await repo.createFlashcard(deck.id, { front: 'c', back: '3' }),
    ];
    const fronts = async () => (await repo.listFlashcards(deck.id)).map((x) => `${x.front}${x.position}`);

    expect(await repo.moveFlashcard(c.id, 'up')).toBe(true);
    expect(await fronts()).toEqual(['a0', 'c1', 'b2']);
    expect(await repo.moveFlashcard(a.id, 'up')).toBe(false);
    expect(await repo.moveFlashcard(b.id, 'down')).toBe(false);

    await repo.deleteFlashcard(a.id);
    expect(await fronts()).toEqual(['c0', 'b1']);
    await expect(repo.deleteFlashcard(a.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('quiz questions', () => {
  it('stores options in order and reads them back typed', async () => {
    const { repo } = await setup();
    const deck = await repo.createDeck({ title: 'Quiz' });
    const q = await repo.createQuizQuestion(deck.id, {
      type: 'multiple_choice',
      question: ' Which organ pumps blood? ',
      options: ['Lungs', 'Liver', 'Heart', 'Kidneys'],
      correctAnswerIndex: 2,
      explanation: 'The heart is a muscular pump.',
    });
    expect(q).toMatchObject({
      question: 'Which organ pumps blood?',
      options: ['Lungs', 'Liver', 'Heart', 'Kidneys'],
      correctAnswerIndex: 2,
      position: 0,
    });
    expect(await repo.listQuizQuestions(deck.id)).toEqual([q]);
  });

  it('rejects malformed questions', async () => {
    const { repo } = await setup();
    const deck = await repo.createDeck({ title: 'Quiz' });
    const base = { type: 'multiple_choice' as const, question: 'Q?', options: ['A', 'B'], correctAnswerIndex: 0 };
    const issue = (input: object) => repo.createQuizQuestion(deck.id, { ...base, ...input });

    await expect(issue({ options: ['Only one'] })).rejects.toMatchObject({ issues: { options: expect.any(String) } });
    await expect(issue({ options: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] })).rejects.toBeInstanceOf(ValidationError);
    await expect(issue({ options: ['Same', 'same'] })).rejects.toMatchObject({ issues: { options: expect.any(String) } });
    await expect(issue({ options: ['A', ''] })).rejects.toMatchObject({ issues: { 'options.1': expect.any(String) } });
    await expect(issue({ correctAnswerIndex: 2 })).rejects.toMatchObject({ issues: { correctAnswerIndex: expect.any(String) } });
    await expect(issue({ correctAnswerIndex: 0.5 })).rejects.toBeInstanceOf(ValidationError);
    await expect(issue({ options: 'A,B' })).rejects.toMatchObject({ issues: { options: expect.any(String) } });
    await expect(issue({ type: 'true_false', options: ['T', 'F', 'Maybe'] })).rejects.toBeInstanceOf(ValidationError);
    expect(await repo.listQuizQuestions(deck.id)).toEqual([]);
  });

  it('updates options atomically and deletes questions', async () => {
    const { repo } = await setup();
    const deck = await repo.createDeck({ title: 'Quiz' });
    const q = await repo.createQuizQuestion(deck.id, {
      type: 'multiple_choice',
      question: 'Pick',
      options: ['A', 'B', 'C'],
      correctAnswerIndex: 1,
    });
    const updated = await repo.updateQuizQuestion(q.id, {
      type: 'true_false',
      question: 'True?',
      options: ['True', 'False'],
      correctAnswerIndex: 1,
    });
    expect(updated).toMatchObject({ type: 'true_false', options: ['True', 'False'], correctAnswerIndex: 1 });

    // A rejected update leaves the stored question untouched.
    await expect(
      repo.updateQuizQuestion(q.id, { type: 'true_false', question: 'x', options: ['a'], correctAnswerIndex: 0 }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect((await repo.listQuizQuestions(deck.id))[0].options).toEqual(['True', 'False']);

    await repo.deleteQuizQuestion(q.id);
    expect(await repo.listQuizQuestions(deck.id)).toEqual([]);
  });
});

describe('database constraints (defence in depth)', () => {
  it('rejects rows that bypass validation', async () => {
    const { db } = await setup();
    const insertDeck = (title: string, source = 'manual') =>
      db.raw
        .prepare("INSERT INTO decks (id, title, source, position, created_at, updated_at) VALUES (?, ?, ?, 0, 'x', 'x')")
        .run(`id-${title}-${source}`, title, source);
    expect(() => insertDeck('  ')).toThrow(/CHECK/);
    expect(() => insertDeck('ok', 'bogus')).toThrow(/CHECK/);
    expect(() =>
      db.raw
        .prepare(
          "INSERT INTO flashcards (id, deck_id, front, back, position, created_at, updated_at) VALUES ('c', 'missing', 'f', 'b', 0, 'x', 'x')",
        )
        .run(),
    ).toThrow(/FOREIGN KEY/);
  });
});
