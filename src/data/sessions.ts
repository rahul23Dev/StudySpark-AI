import {
  computeScore,
  gradeFlashcard,
  gradeQuizAnswer,
  shuffled,
  STUDY_MODES,
  type FlashcardAnswer,
  type Score,
  type StudyMode,
} from '@/study/scoring';

import type { SqlDatabase, SqlValue } from './database';
import { NotFoundError, ValidationError } from './errors';
import { applyCardReview, DUE_CONDITION } from './reviews';
import type { Deck, Flashcard, QuizQuestion } from './types';

export type SessionStatus = 'active' | 'completed' | 'abandoned';

export type StudySession = {
  id: string;
  deckId: string;
  mode: StudyMode;
  status: SessionStatus;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  abandonedAt: string | null;
  /** Saved when the session completes; computed from its attempts. */
  scoreCorrect: number | null;
  scoreTotal: number | null;
};

export type StudyAttempt = {
  id: string;
  sessionId: string;
  itemId: string;
  submittedAnswer: string;
  isCorrect: boolean;
  answeredAt: string;
};

export type SessionItem =
  | { itemId: string; kind: 'flashcard'; card: Flashcard | null; attempt: StudyAttempt | null }
  | { itemId: string; kind: 'question'; question: QuizQuestion | null; attempt: StudyAttempt | null };

/** Everything a player or results screen needs. `card`/`question` is null if it was deleted since. */
export type SessionDetail = {
  session: StudySession;
  deck: Deck | null;
  items: SessionItem[];
  score: Score;
};

/** The deck/card/question reads sessions rely on (provided by the main repository). */
export type ContentReader = {
  getDeck(id: string): Promise<Deck | null>;
  listFlashcards(deckId: string): Promise<Flashcard[]>;
  listQuizQuestions(deckId: string): Promise<QuizQuestion[]>;
  getFlashcard(id: string): Promise<Flashcard | null>;
  getQuizQuestion(id: string): Promise<QuizQuestion | null>;
};

type SessionRow = {
  id: string;
  deck_id: string;
  mode: StudyMode;
  status: SessionStatus;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  abandoned_at: string | null;
  score_correct: number | null;
  score_total: number | null;
};

type AttemptRow = {
  id: string;
  session_id: string;
  item_id: string;
  submitted_answer: string;
  is_correct: number;
  answered_at: string;
};

const toSession = (r: SessionRow): StudySession => ({
  id: r.id,
  deckId: r.deck_id,
  mode: r.mode,
  status: r.status,
  startedAt: r.started_at,
  updatedAt: r.updated_at,
  completedAt: r.completed_at,
  abandonedAt: r.abandoned_at,
  scoreCorrect: r.score_correct === null ? null : Number(r.score_correct),
  scoreTotal: r.score_total === null ? null : Number(r.score_total),
});

const toAttempt = (r: AttemptRow): StudyAttempt => ({
  id: r.id,
  sessionId: r.session_id,
  itemId: r.item_id,
  submittedAnswer: r.submitted_answer,
  isCorrect: Number(r.is_correct) === 1,
  answeredAt: r.answered_at,
});

const isUniqueViolation = (error: unknown) => /UNIQUE constraint failed/i.test(String((error as Error)?.message ?? error));

export function createSessionApi(
  db: SqlDatabase,
  deps: { uuid: () => string; now: () => string },
  content: ContentReader,
) {
  const run = (sql: string, params: SqlValue[] = []) => db.runAsync(sql, params);
  const first = <T>(sql: string, params: SqlValue[] = []) => db.getFirstAsync<T>(sql, params);
  const all = <T>(sql: string, params: SqlValue[] = []) => db.getAllAsync<T>(sql, params);

  async function requireSession(id: string): Promise<StudySession> {
    const row = await first<SessionRow>('SELECT * FROM study_sessions WHERE id = ?', [id]);
    if (!row) throw new NotFoundError('Study session', id);
    return toSession(row);
  }

  const itemIdsOf = async (sessionId: string) =>
    (await all<{ item_id: string }>('SELECT item_id FROM study_session_items WHERE session_id = ? ORDER BY position', [
      sessionId,
    ])).map((r) => r.item_id);

  const attemptsOf = async (sessionId: string) =>
    (await all<AttemptRow>('SELECT * FROM study_attempts WHERE session_id = ? ORDER BY answered_at, id', [sessionId])).map(
      toAttempt,
    );

  async function scoreOf(sessionId: string): Promise<Score> {
    return computeScore(await itemIdsOf(sessionId), await attemptsOf(sessionId));
  }

  return {
    /** The session in progress for this deck and mode, if any. */
    async getActiveSession(deckId: string, mode: StudyMode): Promise<StudySession | null> {
      const row = await first<SessionRow>(
        "SELECT * FROM study_sessions WHERE deck_id = ? AND mode = ? AND status = 'active'",
        [deckId, mode],
      );
      return row ? toSession(row) : null;
    },

    /**
     * Starts a new session over the deck's current cards (flashcards) or questions (quiz).
     * Any session already in progress for the same deck and mode is abandoned first.
     */
    async startSession(
      deckId: string,
      mode: StudyMode,
      {
        shuffle = false,
        random = Math.random,
        dueOnly = false,
      }: {
        shuffle?: boolean;
        random?: () => number;
        /** Flashcards only: just the cards due for review now (most overdue first, then new). */
        dueOnly?: boolean;
      } = {},
    ): Promise<StudySession> {
      if (!STUDY_MODES.includes(mode)) throw new ValidationError({ mode: `Unknown study mode "${String(mode)}".` });
      if (!(await content.getDeck(deckId))) throw new NotFoundError('Deck', deckId);
      if (dueOnly && mode !== 'flashcards') throw new ValidationError({ mode: 'Only flashcards can be reviewed by due date.' });
      const ids = dueOnly
        ? (
            await all<{ id: string }>(
              `SELECT f.id FROM flashcards f LEFT JOIN card_reviews r ON r.card_id = f.id
               WHERE f.deck_id = ? AND ${DUE_CONDITION}
               ORDER BY r.due_at IS NULL, r.due_at, f.position`,
              [deckId, deps.now()],
            )
          ).map((r) => r.id)
        : mode === 'flashcards'
          ? (await content.listFlashcards(deckId)).map((c) => c.id)
          : (await content.listQuizQuestions(deckId)).map((q) => q.id);
      if (ids.length === 0) {
        throw new ValidationError({
          items: dueOnly
            ? 'Nothing in this deck is due for review right now.'
            : mode === 'flashcards'
              ? 'Add some cards before studying.'
              : 'Add some quiz questions first.',
        });
      }
      const order = shuffle ? shuffled(ids, random) : ids;
      const id = deps.uuid();
      const at = deps.now();
      await db.withTransactionAsync(async () => {
        await run(
          "UPDATE study_sessions SET status = 'abandoned', abandoned_at = ?, updated_at = ? WHERE deck_id = ? AND mode = ? AND status = 'active'",
          [at, at, deckId, mode],
        );
        await run(
          "INSERT INTO study_sessions (id, deck_id, mode, status, started_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?)",
          [id, deckId, mode, at, at],
        );
        for (const [position, itemId] of order.entries()) {
          await run('INSERT INTO study_session_items (session_id, position, item_id) VALUES (?, ?, ?)', [
            id,
            position,
            itemId,
          ]);
        }
      });
      return requireSession(id);
    },

    async getSession(id: string): Promise<StudySession | null> {
      const row = await first<SessionRow>('SELECT * FROM study_sessions WHERE id = ?', [id]);
      return row ? toSession(row) : null;
    },

    /** Session with its items in order, each item's saved attempt, and the score so far. */
    async getSessionDetail(id: string): Promise<SessionDetail> {
      const session = await requireSession(id);
      const ids = await itemIdsOf(id);
      const attempts = await attemptsOf(id);
      const byItem = new Map(attempts.map((a) => [a.itemId, a]));
      const items: SessionItem[] = [];
      for (const itemId of ids) {
        const attempt = byItem.get(itemId) ?? null;
        items.push(
          session.mode === 'flashcards'
            ? { itemId, kind: 'flashcard', card: await content.getFlashcard(itemId), attempt }
            : { itemId, kind: 'question', question: await content.getQuizQuestion(itemId), attempt },
        );
      }
      return { session, deck: await content.getDeck(session.deckId), items, score: computeScore(ids, attempts) };
    },

    /**
     * Saves one answer, graded here from the stored card/question (never trusted from
     * the UI). Safe to retry: an item that already has an answer returns the saved
     * attempt with `duplicate: true` and nothing changes.
     */
    async recordAttempt(
      sessionId: string,
      itemId: string,
      answer: string,
    ): Promise<{ attempt: StudyAttempt; duplicate: boolean }> {
      const session = await requireSession(sessionId);
      const existing = await first<AttemptRow>('SELECT * FROM study_attempts WHERE session_id = ? AND item_id = ?', [
        sessionId,
        itemId,
      ]);
      if (existing) return { attempt: toAttempt(existing), duplicate: true };
      if (session.status !== 'active') throw new ValidationError({ session: 'This session has already ended.' });
      const inSession = await first('SELECT 1 FROM study_session_items WHERE session_id = ? AND item_id = ?', [
        sessionId,
        itemId,
      ]);
      if (!inSession) throw new ValidationError({ item: 'That card or question is not part of this session.' });

      let isCorrect: boolean;
      let card: Flashcard | null = null;
      if (session.mode === 'flashcards') {
        card = await content.getFlashcard(itemId);
        if (!card) throw new ValidationError({ item: 'This card was deleted.' });
        isCorrect = gradeFlashcard(answer);
      } else {
        const question = await content.getQuizQuestion(itemId);
        if (!question) throw new ValidationError({ item: 'This question was deleted.' });
        isCorrect = gradeQuizAnswer(question, answer);
      }

      const id = deps.uuid();
      const at = deps.now();
      try {
        await db.withTransactionAsync(async () => {
          await run(
            'INSERT INTO study_attempts (id, session_id, item_id, submitted_answer, is_correct, answered_at) VALUES (?, ?, ?, ?, ?, ?)',
            [id, sessionId, itemId, answer, isCorrect ? 1 : 0, at],
          );
          // Same transaction: the schedule always reflects exactly the saved answers.
          if (card) {
            await applyCardReview(db, {
              cardId: card.id,
              deckId: card.deckId,
              result: answer as FlashcardAnswer,
              reviewedAt: at,
            });
          }
          await run('UPDATE study_sessions SET updated_at = ? WHERE id = ?', [at, sessionId]);
        });
      } catch (error) {
        // Two saves raced: the other one won, so return what it stored.
        if (!isUniqueViolation(error)) throw error;
        const winner = await first<AttemptRow>('SELECT * FROM study_attempts WHERE session_id = ? AND item_id = ?', [
          sessionId,
          itemId,
        ]);
        if (!winner) throw error;
        return { attempt: toAttempt(winner), duplicate: true };
      }
      return { attempt: { id, sessionId, itemId, submittedAnswer: answer, isCorrect, answeredAt: at }, duplicate: false };
    },

    /**
     * Shuffles the items not answered yet; answered ones keep their place at the front.
     * Returns the new order.
     */
    async shuffleRemaining(sessionId: string, random: () => number = Math.random): Promise<string[]> {
      const session = await requireSession(sessionId);
      if (session.status !== 'active') throw new ValidationError({ session: 'This session has already ended.' });
      const ids = await itemIdsOf(sessionId);
      const answered = new Set((await attemptsOf(sessionId)).map((a) => a.itemId));
      const order = [...ids.filter((id) => answered.has(id)), ...shuffled(ids.filter((id) => !answered.has(id)), random)];
      await db.withTransactionAsync(async () => {
        // Move everything out of the way first: (session_id, position) is a primary key.
        await run('UPDATE study_session_items SET position = position + ? WHERE session_id = ?', [ids.length, sessionId]);
        for (const [position, itemId] of order.entries()) {
          await run('UPDATE study_session_items SET position = ? WHERE session_id = ? AND item_id = ?', [
            position,
            sessionId,
            itemId,
          ]);
        }
        await run('UPDATE study_sessions SET updated_at = ? WHERE id = ?', [deps.now(), sessionId]);
      });
      return order;
    },

    /**
     * Ends the session and saves its score, computed from the saved attempts. Calling it
     * again on a completed session just returns it (safe to retry).
     */
    async completeSession(sessionId: string): Promise<StudySession> {
      const session = await requireSession(sessionId);
      if (session.status === 'completed') return session;
      if (session.status === 'abandoned') throw new ValidationError({ session: 'This session was ended early.' });
      const score = await scoreOf(sessionId);
      const at = deps.now();
      await run(
        "UPDATE study_sessions SET status = 'completed', completed_at = ?, updated_at = ?, score_correct = ?, score_total = ? WHERE id = ? AND status = 'active'",
        [at, at, score.correct, score.total, sessionId],
      );
      return requireSession(sessionId);
    },

    /** Ends a session without a score. Already-abandoned sessions are left as they are. */
    async abandonSession(sessionId: string): Promise<StudySession> {
      const session = await requireSession(sessionId);
      if (session.status === 'abandoned') return session;
      if (session.status === 'completed') throw new ValidationError({ session: 'This session is already complete.' });
      const at = deps.now();
      await run(
        "UPDATE study_sessions SET status = 'abandoned', abandoned_at = ?, updated_at = ? WHERE id = ? AND status = 'active'",
        [at, at, sessionId],
      );
      return requireSession(sessionId);
    },

    /** Completed sessions, newest first (optionally for one deck). */
    async listCompletedSessions(deckId?: string): Promise<StudySession[]> {
      const rows = deckId
        ? await all<SessionRow>(
            "SELECT * FROM study_sessions WHERE status = 'completed' AND deck_id = ? ORDER BY completed_at DESC",
            [deckId],
          )
        : await all<SessionRow>("SELECT * FROM study_sessions WHERE status = 'completed' ORDER BY completed_at DESC");
      return rows.map(toSession);
    },
  };
}
