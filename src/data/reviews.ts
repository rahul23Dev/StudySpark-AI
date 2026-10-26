/**
 * Spaced-repetition persistence (table card_reviews) and the activity feed used for
 * progress statistics. Scheduling rules live in src/study/scheduler.ts; this file
 * only stores and queries their results.
 */
import type { ActivityAttempt } from '@/study/progress';
import { nextReviewState, replayReviews, type ReviewResult, type ReviewState } from '@/study/scheduler';

import type { SqlDatabase, SqlValue } from './database';
import { NotFoundError } from './errors';
import type { Difficulty } from './types';

type ReviewRow = {
  card_id: string;
  deck_id: string;
  repetitions: number;
  lapses: number;
  interval_minutes: number;
  due_at: string;
  last_reviewed_at: string;
  last_result: ReviewResult;
};

export type CardSchedule = ReviewState & { cardId: string; deckId: string };

const toSchedule = (r: ReviewRow): CardSchedule => ({
  cardId: r.card_id,
  deckId: r.deck_id,
  repetitions: Number(r.repetitions),
  lapses: Number(r.lapses),
  intervalMinutes: Number(r.interval_minutes),
  dueAt: r.due_at,
  lastReviewedAt: r.last_reviewed_at,
  lastResult: r.last_result,
});

export type DueCard = {
  cardId: string;
  deckId: string;
  deckTitle: string;
  front: string;
  back: string;
  difficulty: Difficulty;
  /** null for a new card (never reviewed, due immediately). */
  dueAt: string | null;
};

export type DeckDueSummary = { deckId: string; deckTitle: string; due: number; newCards: number };

export type { ActivityAttempt };

/**
 * Applies one flashcard review to the stored schedule. Call it inside the transaction
 * that saves the attempt, so the answer and the schedule can't disagree.
 */
export async function applyCardReview(
  db: SqlDatabase,
  args: { cardId: string; deckId: string; result: ReviewResult; reviewedAt: string },
): Promise<ReviewState> {
  const row = await db.getFirstAsync<ReviewRow>('SELECT * FROM card_reviews WHERE card_id = ?', [args.cardId]);
  const next = nextReviewState(row ? toSchedule(row) : null, args.result, args.reviewedAt);
  await db.runAsync(
    `INSERT INTO card_reviews (card_id, deck_id, repetitions, lapses, interval_minutes, due_at, last_reviewed_at, last_result, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (card_id) DO UPDATE SET
       repetitions = excluded.repetitions, lapses = excluded.lapses, interval_minutes = excluded.interval_minutes,
       due_at = excluded.due_at, last_reviewed_at = excluded.last_reviewed_at, last_result = excluded.last_result,
       updated_at = excluded.updated_at`,
    [
      args.cardId,
      args.deckId,
      next.repetitions,
      next.lapses,
      next.intervalMinutes,
      next.dueAt,
      next.lastReviewedAt,
      next.lastResult,
      args.reviewedAt,
    ],
  );
  return next;
}

/** SQL fragment: card `f` is due at `?` (new, or scheduled at or before then). */
export const DUE_CONDITION = '(r.card_id IS NULL OR r.due_at <= ?)';

export function createReviewApi(db: SqlDatabase, deps: { now: () => string }) {
  const all = <T>(sql: string, params: SqlValue[] = []) => db.getAllAsync<T>(sql, params);

  return {
    async getCardSchedule(cardId: string): Promise<CardSchedule | null> {
      const row = await db.getFirstAsync<ReviewRow>('SELECT * FROM card_reviews WHERE card_id = ?', [cardId]);
      return row ? toSchedule(row) : null;
    },

    /** Cards due at `now`: reviewed cards by due time (most overdue first), then new cards in deck order. */
    async listDueCards({ now = new Date(), deckId }: { now?: Date; deckId?: string } = {}): Promise<DueCard[]> {
      const params: SqlValue[] = [now.toISOString()];
      if (deckId) params.push(deckId);
      const rows = await all<{
        id: string;
        deck_id: string;
        title: string;
        front: string;
        back: string;
        difficulty: Difficulty;
        due_at: string | null;
      }>(
        `SELECT f.id, f.deck_id, d.title, f.front, f.back, f.difficulty, r.due_at
         FROM flashcards f
         JOIN decks d ON d.id = f.deck_id
         LEFT JOIN card_reviews r ON r.card_id = f.id
         WHERE ${DUE_CONDITION} ${deckId ? 'AND f.deck_id = ?' : ''}
         ORDER BY r.due_at IS NULL, r.due_at, d.position, f.position`,
        params,
      );
      return rows.map((r) => ({
        cardId: r.id,
        deckId: r.deck_id,
        deckTitle: r.title,
        front: r.front,
        back: r.back,
        difficulty: r.difficulty,
        dueAt: r.due_at,
      }));
    },

    /** Per-deck counts of reviewed cards due now and new (never reviewed) cards. Decks with neither are omitted. */
    async listDueByDeck(now: Date = new Date()): Promise<DeckDueSummary[]> {
      const rows = await all<{ id: string; title: string; due: number; new_cards: number }>(
        `SELECT d.id, d.title,
           SUM(CASE WHEN r.card_id IS NOT NULL AND r.due_at <= ? THEN 1 ELSE 0 END) AS due,
           SUM(CASE WHEN r.card_id IS NULL THEN 1 ELSE 0 END) AS new_cards
         FROM decks d
         JOIN flashcards f ON f.deck_id = d.id
         LEFT JOIN card_reviews r ON r.card_id = f.id
         GROUP BY d.id
         HAVING due > 0 OR new_cards > 0
         ORDER BY due DESC, d.position`,
        [now.toISOString()],
      );
      return rows.map((r) => ({ deckId: r.id, deckTitle: r.title, due: Number(r.due), newCards: Number(r.new_cards) }));
    },

    /** Manual reset: the card becomes new (due now). Its past answers stay in history. */
    async resetCardSchedule(cardId: string): Promise<void> {
      const exists = await db.getFirstAsync('SELECT 1 FROM flashcards WHERE id = ?', [cardId]);
      if (!exists) throw new NotFoundError('Flashcard', cardId);
      await db.runAsync('DELETE FROM card_reviews WHERE card_id = ?', [cardId]);
    },

    /** Manual reset for every card in a deck. Returns how many schedules were cleared. */
    async resetDeckSchedule(deckId: string): Promise<number> {
      const exists = await db.getFirstAsync('SELECT 1 FROM decks WHERE id = ?', [deckId]);
      if (!exists) throw new NotFoundError('Deck', deckId);
      const { changes } = await db.runAsync('DELETE FROM card_reviews WHERE deck_id = ?', [deckId]);
      return changes;
    },

    /**
     * Rebuilds every schedule from saved flashcard answers (used once when upgrading a
     * database that has answers from before scheduling existed). Deterministic.
     */
    async rebuildSchedules(): Promise<number> {
      const rows = await all<{ item_id: string; deck_id: string; submitted_answer: ReviewResult; answered_at: string }>(
        `SELECT a.item_id, f.deck_id, a.submitted_answer, a.answered_at
         FROM study_attempts a
         JOIN study_sessions s ON s.id = a.session_id AND s.mode = 'flashcards'
         JOIN flashcards f ON f.id = a.item_id
         WHERE a.submitted_answer IN ('know', 'review')
         ORDER BY a.answered_at, a.id`,
      );
      const byCard = new Map<string, { deckId: string; reviews: { result: ReviewResult; reviewedAt: string }[] }>();
      for (const r of rows) {
        const entry = byCard.get(r.item_id) ?? { deckId: r.deck_id, reviews: [] };
        entry.reviews.push({ result: r.submitted_answer, reviewedAt: r.answered_at });
        byCard.set(r.item_id, entry);
      }
      const at = deps.now();
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM card_reviews', []);
        for (const [cardId, { deckId, reviews }] of byCard) {
          const s = replayReviews(reviews)!;
          await db.runAsync(
            `INSERT INTO card_reviews (card_id, deck_id, repetitions, lapses, interval_minutes, due_at, last_reviewed_at, last_result, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [cardId, deckId, s.repetitions, s.lapses, s.intervalMinutes, s.dueAt, s.lastReviewedAt, s.lastResult, at],
          );
        }
      });
      return byCard.size;
    },

    /** Every saved answer with its mode and deck, oldest first: the raw data behind Progress. */
    async listActivity(): Promise<ActivityAttempt[]> {
      const rows = await all<{
        answered_at: string;
        mode: 'flashcards' | 'quiz';
        is_correct: number;
        deck_id: string;
        title: string;
        subject: string;
      }>(
        `SELECT a.answered_at, s.mode, a.is_correct, d.id AS deck_id, d.title, d.subject
         FROM study_attempts a
         JOIN study_sessions s ON s.id = a.session_id
         JOIN decks d ON d.id = s.deck_id
         ORDER BY a.answered_at, a.id`,
      );
      return rows.map((r) => ({
        answeredAt: r.answered_at,
        mode: r.mode,
        isCorrect: Number(r.is_correct) === 1,
        deckId: r.deck_id,
        deckTitle: r.title,
        deckSubject: r.subject,
      }));
    },
  };
}
