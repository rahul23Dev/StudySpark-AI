import { withSerializedTransactions, type SqlDatabase, type SqlValue } from './database';
import { NotFoundError, ValidationError } from './errors';
import {
  DECK_SORTS,
  type Deck,
  type DeckInput,
  type DeckSort,
  type DeckSummary,
  type Flashcard,
  type FlashcardInput,
  type QuizQuestion,
  type QuizQuestionInput,
} from './types';
import { createSessionApi } from './sessions';
import { LIMITS, validateDeckInput, validateFlashcardInput, validateQuizQuestionInput } from './validation';

export type RepositoryDeps = {
  /** Returns a new UUID (expo-crypto in the app, node:crypto in tests). */
  uuid: () => string;
  /** Returns the current time as an ISO timestamp. */
  now: () => string;
};

type DeckRow = {
  id: string;
  title: string;
  description: string;
  subject: string;
  source: Deck['source'];
  position: number;
  created_at: string;
  updated_at: string;
  card_count?: number;
};

type FlashcardRow = {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  difficulty: Flashcard['difficulty'];
  position: number;
  created_at: string;
  updated_at: string;
};

type QuestionRow = {
  id: string;
  deck_id: string;
  type: QuizQuestion['type'];
  question: string;
  correct_answer_index: number;
  explanation: string;
  position: number;
  created_at: string;
  updated_at: string;
};

type OptionRow = { question_id: string; position: number; text: string };

const toDeck = (r: DeckRow): Deck => ({
  id: r.id,
  title: r.title,
  description: r.description,
  subject: r.subject,
  source: r.source,
  position: Number(r.position),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toFlashcard = (r: FlashcardRow): Flashcard => ({
  id: r.id,
  deckId: r.deck_id,
  front: r.front,
  back: r.back,
  difficulty: r.difficulty,
  position: Number(r.position),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

// Fixed ORDER BY clauses; the sort key is checked against DECK_SORTS, never interpolated raw.
const DECK_ORDER: Record<DeckSort, string> = {
  updated: 'd.updated_at DESC, d.title COLLATE NOCASE ASC',
  created: 'd.created_at DESC, d.title COLLATE NOCASE ASC',
  title: 'd.title COLLATE NOCASE ASC, d.created_at DESC',
  custom: 'd.position ASC',
};

const escapeLike = (term: string) => term.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Re-throws a ValidationError with its field names prefixed, e.g. "cards.2.front". */
function prefixIssues(error: unknown, prefix: string): unknown {
  if (!(error instanceof ValidationError)) return error;
  return new ValidationError(
    Object.fromEntries(Object.entries(error.issues).map(([field, message]) => [`${prefix}.${field}`, message])),
  );
}

export type StudyRepository = ReturnType<typeof createStudyRepository>;

export function createStudyRepository(connection: SqlDatabase, deps: RepositoryDeps) {
  const db = withSerializedTransactions(connection);
  const run = (sql: string, params: SqlValue[] = []) => db.runAsync(sql, params);
  const first = <T>(sql: string, params: SqlValue[] = []) => db.getFirstAsync<T>(sql, params);
  const all = <T>(sql: string, params: SqlValue[] = []) => db.getAllAsync<T>(sql, params);

  async function requireDeckRow(id: string): Promise<DeckRow> {
    const row = await first<DeckRow>('SELECT * FROM decks WHERE id = ?', [id]);
    if (!row) throw new NotFoundError('Deck', id);
    return row;
  }

  async function requireCardRow(id: string): Promise<FlashcardRow> {
    const row = await first<FlashcardRow>('SELECT * FROM flashcards WHERE id = ?', [id]);
    if (!row) throw new NotFoundError('Flashcard', id);
    return row;
  }

  const touchDeck = (deckId: string, at: string) => run('UPDATE decks SET updated_at = ? WHERE id = ?', [at, deckId]);

  async function nextPosition(table: 'decks' | 'flashcards' | 'quiz_questions', deckId?: string): Promise<number> {
    const row = deckId
      ? await first<{ next: number }>(`SELECT COALESCE(MAX(position), -1) + 1 AS next FROM ${table} WHERE deck_id = ?`, [
          deckId,
        ])
      : await first<{ next: number }>(`SELECT COALESCE(MAX(position), -1) + 1 AS next FROM ${table}`);
    return Number(row?.next ?? 0);
  }

  async function insertOptions(questionId: string, options: string[]) {
    for (const [position, text] of options.entries()) {
      await run('INSERT INTO quiz_question_options (question_id, position, text) VALUES (?, ?, ?)', [
        questionId,
        position,
        text,
      ]);
    }
  }

  async function loadQuestions(where: string, params: SqlValue[]): Promise<QuizQuestion[]> {
    const rows = await all<QuestionRow>(`SELECT * FROM quiz_questions WHERE ${where} ORDER BY position ASC`, params);
    if (rows.length === 0) return [];
    const placeholders = rows.map(() => '?').join(', ');
    const options = await all<OptionRow>(
      `SELECT * FROM quiz_question_options WHERE question_id IN (${placeholders}) ORDER BY question_id, position`,
      rows.map((r) => r.id),
    );
    return rows.map((r) => ({
      id: r.id,
      deckId: r.deck_id,
      type: r.type,
      question: r.question,
      options: options.filter((o) => o.question_id === r.id).map((o) => o.text),
      correctAnswerIndex: Number(r.correct_answer_index),
      explanation: r.explanation,
      position: Number(r.position),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  const content = {
    // ---------- Decks ----------

    async listDecks({ search = '', sort = 'updated' }: { search?: string; sort?: DeckSort } = {}): Promise<DeckSummary[]> {
      if (!DECK_SORTS.includes(sort)) throw new ValidationError({ sort: `Unknown sort "${String(sort)}".` });
      const term = search.trim();
      const pattern = `%${escapeLike(term)}%`;
      const rows = await all<DeckRow>(
        `SELECT d.*, (SELECT COUNT(*) FROM flashcards f WHERE f.deck_id = d.id) AS card_count
         FROM decks d
         WHERE ? = '' OR d.title LIKE ? ESCAPE '\\' OR d.subject LIKE ? ESCAPE '\\' OR d.description LIKE ? ESCAPE '\\'
         ORDER BY ${DECK_ORDER[sort]}`,
        [term, pattern, pattern, pattern],
      );
      return rows.map((r) => ({ ...toDeck(r), cardCount: Number(r.card_count ?? 0) }));
    },

    async getDeck(id: string): Promise<Deck | null> {
      const row = await first<DeckRow>('SELECT * FROM decks WHERE id = ?', [id]);
      return row ? toDeck(row) : null;
    },

    async createDeck(input: DeckInput): Promise<Deck> {
      const deck = validateDeckInput(input);
      const id = deps.uuid();
      const at = deps.now();
      await db.withTransactionAsync(async () => {
        const position = await nextPosition('decks');
        await run(
          `INSERT INTO decks (id, title, description, subject, source, position, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, deck.title, deck.description, deck.subject, deck.source, position, at, at],
        );
      });
      return toDeck(await requireDeckRow(id));
    },

    /** Rename or edit a deck. Omitted fields keep their current value. */
    async updateDeck(id: string, changes: Partial<DeckInput>): Promise<Deck> {
      const current = toDeck(await requireDeckRow(id));
      const deck = validateDeckInput({ ...current, ...changes });
      await run('UPDATE decks SET title = ?, description = ?, subject = ?, source = ?, updated_at = ? WHERE id = ?', [
        deck.title,
        deck.description,
        deck.subject,
        deck.source,
        deps.now(),
        id,
      ]);
      return toDeck(await requireDeckRow(id));
    },

    /** Copies a deck with all its flashcards and quiz questions under new ids. */
    async duplicateDeck(id: string): Promise<Deck> {
      const source = toDeck(await requireDeckRow(id));
      const suffix = ' (copy)';
      const title = source.title.slice(0, LIMITS.deckTitle - suffix.length).trimEnd() + suffix;
      const newId = deps.uuid();
      const at = deps.now();
      await db.withTransactionAsync(async () => {
        const position = await nextPosition('decks');
        await run(
          `INSERT INTO decks (id, title, description, subject, source, position, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'duplicate', ?, ?, ?)`,
          [newId, title, source.description, source.subject, position, at, at],
        );
        const cards = await all<FlashcardRow>('SELECT * FROM flashcards WHERE deck_id = ? ORDER BY position', [id]);
        for (const card of cards) {
          await run(
            `INSERT INTO flashcards (id, deck_id, front, back, difficulty, position, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [deps.uuid(), newId, card.front, card.back, card.difficulty, card.position, at, at],
          );
        }
        for (const q of await loadQuestions('deck_id = ?', [id])) {
          const questionId = deps.uuid();
          await run(
            `INSERT INTO quiz_questions (id, deck_id, type, question, correct_answer_index, explanation, position, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [questionId, newId, q.type, q.question, q.correctAnswerIndex, q.explanation, q.position, at, at],
          );
          await insertOptions(questionId, q.options);
        }
      });
      return toDeck(await requireDeckRow(newId));
    },

    /** Deletes a deck; its flashcards, questions and options go with it (ON DELETE CASCADE). */
    async deleteDeck(id: string): Promise<void> {
      const { changes } = await run('DELETE FROM decks WHERE id = ?', [id]);
      if (changes === 0) throw new NotFoundError('Deck', id);
    },

    /** Saves a new manual order. `orderedIds` must list every deck exactly once. */
    async reorderDecks(orderedIds: string[]): Promise<void> {
      const existing = (await all<{ id: string }>('SELECT id FROM decks')).map((r) => r.id);
      const same =
        orderedIds.length === existing.length &&
        new Set(orderedIds).size === orderedIds.length &&
        orderedIds.every((id) => existing.includes(id));
      if (!same) throw new ValidationError({ order: 'The new order must include every deck exactly once.' });
      await db.withTransactionAsync(async () => {
        for (const [position, id] of orderedIds.entries()) {
          await run('UPDATE decks SET position = ? WHERE id = ?', [position, id]);
        }
      });
    },

    async getStats(): Promise<{ deckCount: number; cardCount: number }> {
      const row = await first<{ decks: number; cards: number }>(
        'SELECT (SELECT COUNT(*) FROM decks) AS decks, (SELECT COUNT(*) FROM flashcards) AS cards',
      );
      return { deckCount: Number(row?.decks ?? 0), cardCount: Number(row?.cards ?? 0) };
    },

    // ---------- Flashcards ----------

    async listFlashcards(deckId: string): Promise<Flashcard[]> {
      const rows = await all<FlashcardRow>('SELECT * FROM flashcards WHERE deck_id = ? ORDER BY position ASC', [deckId]);
      return rows.map(toFlashcard);
    },

    async getFlashcard(id: string): Promise<Flashcard | null> {
      const row = await first<FlashcardRow>('SELECT * FROM flashcards WHERE id = ?', [id]);
      return row ? toFlashcard(row) : null;
    },

    /** Adds a card at the end of the deck. */
    async createFlashcard(deckId: string, input: FlashcardInput): Promise<Flashcard> {
      const card = validateFlashcardInput(input);
      await requireDeckRow(deckId);
      const id = deps.uuid();
      const at = deps.now();
      await db.withTransactionAsync(async () => {
        const position = await nextPosition('flashcards', deckId);
        await run(
          `INSERT INTO flashcards (id, deck_id, front, back, difficulty, position, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, deckId, card.front, card.back, card.difficulty, position, at, at],
        );
        await touchDeck(deckId, at);
      });
      return toFlashcard(await requireCardRow(id));
    },

    async updateFlashcard(id: string, changes: Partial<FlashcardInput>): Promise<Flashcard> {
      const current = toFlashcard(await requireCardRow(id));
      const card = validateFlashcardInput({ ...current, ...changes });
      const at = deps.now();
      await db.withTransactionAsync(async () => {
        await run('UPDATE flashcards SET front = ?, back = ?, difficulty = ?, updated_at = ? WHERE id = ?', [
          card.front,
          card.back,
          card.difficulty,
          at,
          id,
        ]);
        await touchDeck(current.deckId, at);
      });
      return toFlashcard(await requireCardRow(id));
    },

    /** Deletes a card and closes the gap so positions stay 0..n-1. */
    async deleteFlashcard(id: string): Promise<void> {
      const card = await requireCardRow(id);
      await db.withTransactionAsync(async () => {
        await run('DELETE FROM flashcards WHERE id = ?', [id]);
        await run('UPDATE flashcards SET position = position - 1 WHERE deck_id = ? AND position > ?', [
          card.deck_id,
          card.position,
        ]);
        await touchDeck(card.deck_id, deps.now());
      });
    },

    /** Swaps a card with its neighbour. Returns false when it is already at that end. */
    async moveFlashcard(id: string, direction: 'up' | 'down'): Promise<boolean> {
      const card = await requireCardRow(id);
      const target = card.position + (direction === 'up' ? -1 : 1);
      const neighbour = await first<FlashcardRow>('SELECT * FROM flashcards WHERE deck_id = ? AND position = ?', [
        card.deck_id,
        target,
      ]);
      if (!neighbour) return false;
      await db.withTransactionAsync(async () => {
        await run('UPDATE flashcards SET position = ? WHERE id = ?', [card.position, neighbour.id]);
        await run('UPDATE flashcards SET position = ? WHERE id = ?', [target, card.id]);
        await touchDeck(card.deck_id, deps.now());
      });
      return true;
    },

    // ---------- Quiz questions ----------

    async listQuizQuestions(deckId: string): Promise<QuizQuestion[]> {
      return loadQuestions('deck_id = ?', [deckId]);
    },

    async createQuizQuestion(deckId: string, input: QuizQuestionInput): Promise<QuizQuestion> {
      const q = validateQuizQuestionInput(input);
      await requireDeckRow(deckId);
      const id = deps.uuid();
      const at = deps.now();
      await db.withTransactionAsync(async () => {
        const position = await nextPosition('quiz_questions', deckId);
        await run(
          `INSERT INTO quiz_questions (id, deck_id, type, question, correct_answer_index, explanation, position, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, deckId, q.type, q.question, q.correctAnswerIndex, q.explanation, position, at, at],
        );
        await insertOptions(id, q.options);
        await touchDeck(deckId, at);
      });
      return (await loadQuestions('id = ?', [id]))[0];
    },

    /** Replaces a question's text, options and answer. */
    async updateQuizQuestion(id: string, input: QuizQuestionInput): Promise<QuizQuestion> {
      const q = validateQuizQuestionInput(input);
      const existing = await first<QuestionRow>('SELECT * FROM quiz_questions WHERE id = ?', [id]);
      if (!existing) throw new NotFoundError('Quiz question', id);
      const at = deps.now();
      await db.withTransactionAsync(async () => {
        await run(
          `UPDATE quiz_questions SET type = ?, question = ?, correct_answer_index = ?, explanation = ?, updated_at = ?
           WHERE id = ?`,
          [q.type, q.question, q.correctAnswerIndex, q.explanation, at, id],
        );
        await run('DELETE FROM quiz_question_options WHERE question_id = ?', [id]);
        await insertOptions(id, q.options);
        await touchDeck(existing.deck_id, at);
      });
      return (await loadQuestions('id = ?', [id]))[0];
    },

    async deleteQuizQuestion(id: string): Promise<void> {
      const existing = await first<QuestionRow>('SELECT * FROM quiz_questions WHERE id = ?', [id]);
      if (!existing) throw new NotFoundError('Quiz question', id);
      await db.withTransactionAsync(async () => {
        await run('DELETE FROM quiz_questions WHERE id = ?', [id]);
        await run('UPDATE quiz_questions SET position = position - 1 WHERE deck_id = ? AND position > ?', [
          existing.deck_id,
          existing.position,
        ]);
        await touchDeck(existing.deck_id, deps.now());
      });
    },

    async getQuizQuestion(id: string): Promise<QuizQuestion | null> {
      return (await loadQuestions('id = ?', [id]))[0] ?? null;
    },

    /**
     * Creates a deck together with its cards and quiz questions in one transaction.
     * Everything is validated first; if any item is invalid, or a write fails, nothing
     * is saved and existing decks are untouched. Used to save AI-generated content.
     */
    async createDeckWithContent(input: {
      deck: DeckInput;
      cards?: FlashcardInput[];
      questions?: QuizQuestionInput[];
    }): Promise<Deck> {
      const deck = validateDeckInput(input.deck);
      const cards = (input.cards ?? []).map((card, i) => {
        try {
          return validateFlashcardInput(card);
        } catch (error) {
          throw prefixIssues(error, `cards.${i}`);
        }
      });
      const questions = (input.questions ?? []).map((q, i) => {
        try {
          return validateQuizQuestionInput(q);
        } catch (error) {
          throw prefixIssues(error, `questions.${i}`);
        }
      });
      const id = deps.uuid();
      const at = deps.now();
      await db.withTransactionAsync(async () => {
        const position = await nextPosition('decks');
        await run(
          `INSERT INTO decks (id, title, description, subject, source, position, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, deck.title, deck.description, deck.subject, deck.source, position, at, at],
        );
        for (const [i, card] of cards.entries()) {
          await run(
            `INSERT INTO flashcards (id, deck_id, front, back, difficulty, position, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [deps.uuid(), id, card.front, card.back, card.difficulty, i, at, at],
          );
        }
        for (const [i, q] of questions.entries()) {
          const questionId = deps.uuid();
          await run(
            `INSERT INTO quiz_questions (id, deck_id, type, question, correct_answer_index, explanation, position, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [questionId, id, q.type, q.question, q.correctAnswerIndex, q.explanation, i, at, at],
          );
          await insertOptions(questionId, q.options);
        }
      });
      return toDeck(await requireDeckRow(id));
    },
  };

  return { ...content, ...createSessionApi(db, deps, content) };
}
