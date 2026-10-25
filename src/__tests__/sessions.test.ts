/** @jest-environment node */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { NotFoundError, ValidationError } from '@/data/errors';
import { computeScore, seededRandom } from '@/study/scoring';

import { openTestRepository } from '../../test/node-sqlite';

async function deckWithContent() {
  const { db, repo } = await openTestRepository();
  const deck = await repo.createDeck({ title: 'Biology' });
  const cards = [
    await repo.createFlashcard(deck.id, { front: 'Cell', back: 'Unit of life' }),
    await repo.createFlashcard(deck.id, { front: 'DNA', back: 'Genetic code' }),
    await repo.createFlashcard(deck.id, { front: 'ATP', back: 'Energy carrier' }),
  ];
  const questions = [
    await repo.createQuizQuestion(deck.id, {
      type: 'multiple_choice',
      question: 'Which organ pumps blood?',
      options: ['Lungs', 'Liver', 'Heart', 'Kidneys'],
      correctAnswerIndex: 2,
      explanation: 'The heart is a muscular pump.',
    }),
    await repo.createQuizQuestion(deck.id, {
      type: 'true_false',
      question: 'Plants make oxygen.',
      options: ['True', 'False'],
      correctAnswerIndex: 0,
    }),
  ];
  return { db, repo, deck, cards, questions };
}

/** The stored score must equal a fresh computation from the saved attempts. */
async function expectScoreMatchesAttempts(repo: Awaited<ReturnType<typeof openTestRepository>>['repo'], sessionId: string) {
  const detail = await repo.getSessionDetail(sessionId);
  const fromAttempts = computeScore(
    detail.items.map((i) => i.itemId),
    detail.items.flatMap((i) => (i.attempt ? [i.attempt] : [])),
  );
  expect(detail.score).toEqual(fromAttempts);
  if (detail.session.status === 'completed') {
    expect(detail.session.scoreCorrect).toBe(fromAttempts.correct);
    expect(detail.session.scoreTotal).toBe(fromAttempts.total);
  }
  return detail;
}

describe('starting and resuming', () => {
  it('starts a session over the deck in card order, with timestamps', async () => {
    const { repo, deck, cards } = await deckWithContent();
    const session = await repo.startSession(deck.id, 'flashcards');
    expect(session).toMatchObject({ deckId: deck.id, mode: 'flashcards', status: 'active', completedAt: null });
    expect(session.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const detail = await repo.getSessionDetail(session.id);
    expect(detail.items.map((i) => i.itemId)).toEqual(cards.map((c) => c.id));
    expect(detail.score).toMatchObject({ total: 3, answered: 0, percent: 0 });
    expect(await repo.getActiveSession(deck.id, 'flashcards')).toEqual(session);
  });

  it('shuffles reproducibly with a seeded random source', async () => {
    const { repo, deck } = await deckWithContent();
    const a = await repo.startSession(deck.id, 'flashcards', { shuffle: true, random: seededRandom(7) });
    const orderA = (await repo.getSessionDetail(a.id)).items.map((i) => i.itemId);
    const b = await repo.startSession(deck.id, 'flashcards', { shuffle: true, random: seededRandom(7) });
    expect((await repo.getSessionDetail(b.id)).items.map((i) => i.itemId)).toEqual(orderA);
  });

  it('refuses to start without cards or questions', async () => {
    const { repo } = await openTestRepository();
    const empty = await repo.createDeck({ title: 'Empty' });
    await expect(repo.startSession(empty.id, 'flashcards')).rejects.toMatchObject({ issues: { items: expect.any(String) } });
    await expect(repo.startSession(empty.id, 'quiz')).rejects.toBeInstanceOf(ValidationError);
    await expect(repo.startSession('missing', 'quiz')).rejects.toBeInstanceOf(NotFoundError);
    await expect(repo.startSession(empty.id, 'speedrun' as never)).rejects.toBeInstanceOf(ValidationError);
  });

  it('starting again abandons the session in progress (one active per deck and mode)', async () => {
    const { repo, deck } = await deckWithContent();
    const first = await repo.startSession(deck.id, 'quiz');
    const flash = await repo.startSession(deck.id, 'flashcards');
    const second = await repo.startSession(deck.id, 'quiz');
    expect((await repo.getSession(first.id))?.status).toBe('abandoned');
    expect((await repo.getSession(flash.id))?.status).toBe('active'); // other mode untouched
    expect((await repo.getActiveSession(deck.id, 'quiz'))?.id).toBe(second.id);
  });
});

describe('recording attempts', () => {
  it('grades quiz answers from the stored question, not the caller', async () => {
    const { repo, deck, questions } = await deckWithContent();
    const s = await repo.startSession(deck.id, 'quiz');
    const right = await repo.recordAttempt(s.id, questions[0].id, '2');
    const wrong = await repo.recordAttempt(s.id, questions[1].id, '1');
    expect(right).toMatchObject({ duplicate: false, attempt: { isCorrect: true, submittedAnswer: '2' } });
    expect(wrong).toMatchObject({ duplicate: false, attempt: { isCorrect: false, submittedAnswer: '1' } });
    expect(right.attempt.answeredAt).toMatch(/^\d{4}-/);
  });

  it('grades flashcards as know / review again', async () => {
    const { repo, deck, cards } = await deckWithContent();
    const s = await repo.startSession(deck.id, 'flashcards');
    expect((await repo.recordAttempt(s.id, cards[0].id, 'know')).attempt.isCorrect).toBe(true);
    expect((await repo.recordAttempt(s.id, cards[1].id, 'review')).attempt.isCorrect).toBe(false);
    await expect(repo.recordAttempt(s.id, cards[2].id, '2')).rejects.toBeInstanceOf(ValidationError);
  });

  it('never saves a second answer for the same item', async () => {
    const { db, repo, deck, questions } = await deckWithContent();
    const s = await repo.startSession(deck.id, 'quiz');
    const firstSave = await repo.recordAttempt(s.id, questions[0].id, '0');
    const again = await repo.recordAttempt(s.id, questions[0].id, '2'); // double tap / changed mind
    expect(again).toEqual({ attempt: firstSave.attempt, duplicate: true });
    // Two saves in flight at once still store exactly one row.
    const [x, y] = await Promise.all([
      repo.recordAttempt(s.id, questions[1].id, '0'),
      repo.recordAttempt(s.id, questions[1].id, '0'),
    ]);
    expect([x.duplicate, y.duplicate].sort()).toEqual([false, true]);
    const count = db.raw.prepare('SELECT COUNT(*) AS n FROM study_attempts WHERE session_id = ?').get(s.id) as { n: number };
    expect(Number(count.n)).toBe(2);
  });

  it('rejects invalid answers and items from outside the session', async () => {
    const { repo, deck, questions, cards } = await deckWithContent();
    const s = await repo.startSession(deck.id, 'quiz');
    await expect(repo.recordAttempt(s.id, questions[0].id, '9')).rejects.toBeInstanceOf(ValidationError);
    await expect(repo.recordAttempt(s.id, questions[0].id, 'Heart')).rejects.toBeInstanceOf(ValidationError);
    await expect(repo.recordAttempt(s.id, cards[0].id, 'know')).rejects.toMatchObject({ issues: { item: expect.any(String) } });
    await expect(repo.recordAttempt('nope', questions[0].id, '2')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('surfaces a failed write and saves exactly once on retry', async () => {
    const { db, repo, deck, cards } = await deckWithContent();
    const s = await repo.startSession(deck.id, 'flashcards');
    jest.spyOn(db, 'withTransactionAsync').mockRejectedValueOnce(new Error('disk I/O error'));
    await expect(repo.recordAttempt(s.id, cards[0].id, 'know')).rejects.toThrow('disk I/O error');
    expect((await repo.getSessionDetail(s.id)).score.answered).toBe(0);

    const retry = await repo.recordAttempt(s.id, cards[0].id, 'know');
    expect(retry.duplicate).toBe(false);
    expect((await repo.recordAttempt(s.id, cards[0].id, 'know')).duplicate).toBe(true);
    expect((await repo.getSessionDetail(s.id)).score).toMatchObject({ answered: 1, correct: 1 });
  });
});

describe('completing and scoring', () => {
  it('scores an empty session (no answers) as 0 of n', async () => {
    const { repo, deck } = await deckWithContent();
    const s = await repo.startSession(deck.id, 'flashcards');
    const done = await repo.completeSession(s.id);
    expect(done).toMatchObject({ status: 'completed', scoreCorrect: 0, scoreTotal: 3 });
    expect(done.completedAt).not.toBeNull();
    await expectScoreMatchesAttempts(repo, s.id);
  });

  it('scores a partial session from the answers saved so far', async () => {
    const { repo, deck, cards } = await deckWithContent();
    const s = await repo.startSession(deck.id, 'flashcards');
    await repo.recordAttempt(s.id, cards[0].id, 'know');
    await repo.recordAttempt(s.id, cards[1].id, 'review');
    const detail = await expectScoreMatchesAttempts(repo, s.id);
    expect(detail.score).toMatchObject({ answered: 2, correct: 1, unanswered: 1, percent: 33 });
    await repo.completeSession(s.id);
    const done = await expectScoreMatchesAttempts(repo, s.id);
    expect(done.session).toMatchObject({ scoreCorrect: 1, scoreTotal: 3 });
  });

  it('scores a perfect quiz', async () => {
    const { repo, deck, questions } = await deckWithContent();
    const s = await repo.startSession(deck.id, 'quiz');
    await repo.recordAttempt(s.id, questions[0].id, '2');
    await repo.recordAttempt(s.id, questions[1].id, '0');
    await repo.completeSession(s.id);
    const detail = await expectScoreMatchesAttempts(repo, s.id);
    expect(detail.score).toMatchObject({ correct: 2, total: 2, percent: 100, perfect: true });
  });

  it('scores an all-incorrect quiz as zero and lists the wrong answers', async () => {
    const { repo, deck, questions } = await deckWithContent();
    const s = await repo.startSession(deck.id, 'quiz');
    await repo.recordAttempt(s.id, questions[0].id, '0');
    await repo.recordAttempt(s.id, questions[1].id, '1');
    await repo.completeSession(s.id);
    const detail = await expectScoreMatchesAttempts(repo, s.id);
    expect(detail.score).toMatchObject({ correct: 0, incorrect: 2, percent: 0 });
    const wrong = detail.items.filter((i) => i.attempt && !i.attempt.isCorrect);
    expect(wrong).toHaveLength(2);
    expect(wrong[0]).toMatchObject({ kind: 'question', question: { explanation: 'The heart is a muscular pump.' } });
  });

  it('is safe to complete twice, and finished sessions take no new answers', async () => {
    const { repo, deck, cards } = await deckWithContent();
    const s = await repo.startSession(deck.id, 'flashcards');
    const first = await repo.completeSession(s.id);
    expect(await repo.completeSession(s.id)).toEqual(first);
    await expect(repo.recordAttempt(s.id, cards[0].id, 'know')).rejects.toMatchObject({
      issues: { session: expect.any(String) },
    });
    await expect(repo.abandonSession(s.id)).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('abandoning, shuffling and deletion', () => {
  it('abandons without a score and cannot be completed afterwards', async () => {
    const { repo, deck } = await deckWithContent();
    const s = await repo.startSession(deck.id, 'quiz');
    const ended = await repo.abandonSession(s.id);
    expect(ended).toMatchObject({ status: 'abandoned', scoreCorrect: null, completedAt: null });
    expect(ended.abandonedAt).not.toBeNull();
    expect(await repo.abandonSession(s.id)).toEqual(ended);
    await expect(repo.completeSession(s.id)).rejects.toBeInstanceOf(ValidationError);
    expect(await repo.getActiveSession(deck.id, 'quiz')).toBeNull();
  });

  it('shuffles only unanswered items and keeps answers attached', async () => {
    const { repo, deck, cards } = await deckWithContent();
    const s = await repo.startSession(deck.id, 'flashcards');
    await repo.recordAttempt(s.id, cards[1].id, 'know');
    const order = await repo.shuffleRemaining(s.id, seededRandom(3));
    expect(order[0]).toBe(cards[1].id);
    expect([...order].sort()).toEqual(cards.map((c) => c.id).sort());
    const detail = await repo.getSessionDetail(s.id);
    expect(detail.items.map((i) => i.itemId)).toEqual(order);
    expect(detail.items[0].attempt?.isCorrect).toBe(true);
  });

  it('shows deleted cards as missing, and deleting the deck removes its sessions', async () => {
    const { db, repo, deck, cards } = await deckWithContent();
    const s = await repo.startSession(deck.id, 'flashcards');
    await repo.deleteFlashcard(cards[2].id);
    const detail = await repo.getSessionDetail(s.id);
    expect(detail.items[2]).toMatchObject({ kind: 'flashcard', card: null });
    await expect(repo.recordAttempt(s.id, cards[2].id, 'know')).rejects.toBeInstanceOf(ValidationError);

    await repo.deleteDeck(deck.id);
    const n = (table: string) => Number((db.raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n);
    expect([n('study_sessions'), n('study_session_items'), n('study_attempts')]).toEqual([0, 0, 0]);
  });
});

describe('persistence', () => {
  it('keeps completed sessions and attempts after the app is closed and reopened', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'studyspark-'));
    const file = path.join(dir, 'studyspark.db');
    try {
      const first = await openTestRepository(file);
      const deck = await first.repo.createDeck({ title: 'Saved' });
      const card = await first.repo.createFlashcard(deck.id, { front: 'Q', back: 'A' });
      const s = await first.repo.startSession(deck.id, 'flashcards');
      await first.repo.recordAttempt(s.id, card.id, 'know');
      await first.repo.completeSession(s.id);
      first.db.close();

      const reopened = await openTestRepository(file);
      const [saved] = await reopened.repo.listCompletedSessions();
      expect(saved).toMatchObject({ id: s.id, status: 'completed', scoreCorrect: 1, scoreTotal: 1 });
      const detail = await reopened.repo.getSessionDetail(s.id);
      expect(detail.items[0].attempt).toMatchObject({ submittedAnswer: 'know', isCorrect: true });
      reopened.db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
