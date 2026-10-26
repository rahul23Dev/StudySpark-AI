/** @jest-environment node */
import { randomUUID } from 'node:crypto';

import { createStudyRepository } from '@/data/repository';
import { computeProgress } from '@/study/progress';

import { openTestDatabase, openTestRepository } from '../../test/node-sqlite';
import { migrateAsync } from '@/data/migrations';

/** A repository whose clock the test controls. */
async function repoAt(start: string) {
  const db = openTestDatabase();
  await migrateAsync(db);
  const clock = { now: new Date(start) };
  const repo = createStudyRepository(db, { uuid: randomUUID, now: () => clock.now.toISOString() });
  const advance = (minutes: number) => {
    clock.now = new Date(clock.now.getTime() + minutes * 60_000);
  };
  return { db, repo, clock, advance };
}

async function deckWithCards(repo: Awaited<ReturnType<typeof repoAt>>['repo'], n = 3) {
  const deck = await repo.createDeck({ title: 'Biology', subject: 'Science' });
  const cards = [];
  for (let i = 0; i < n; i += 1) cards.push(await repo.createFlashcard(deck.id, { front: `Q${i}`, back: `A${i}` }));
  return { deck, cards };
}

describe('card schedules', () => {
  it('starts with every card new and due', async () => {
    const { repo, clock } = await repoAt('2026-10-26T09:00:00Z');
    const { deck, cards } = await deckWithCards(repo);
    expect((await repo.listDueCards({ now: clock.now })).map((c) => c.cardId)).toEqual(cards.map((c) => c.id));
    expect(await repo.listDueByDeck(clock.now)).toEqual([{ deckId: deck.id, deckTitle: 'Biology', due: 0, newCards: 3 }]);
  });

  it('updates due dates after each review, in the same transaction as the answer', async () => {
    const { repo, clock, advance } = await repoAt('2026-10-26T09:00:00Z');
    const { deck, cards } = await deckWithCards(repo, 2);
    const s = await repo.startSession(deck.id, 'flashcards');
    await repo.recordAttempt(s.id, cards[0].id, 'know');
    await repo.recordAttempt(s.id, cards[1].id, 'review');

    expect(await repo.getCardSchedule(cards[0].id)).toMatchObject({ repetitions: 1, dueAt: '2026-10-27T09:00:00.000Z' });
    expect(await repo.getCardSchedule(cards[1].id)).toMatchObject({ lapses: 1, dueAt: '2026-10-26T09:10:00.000Z' });
    expect(await repo.listDueCards({ now: clock.now })).toEqual([]);

    advance(10);
    expect((await repo.listDueCards({ now: clock.now })).map((c) => c.cardId)).toEqual([cards[1].id]);
    advance(24 * 60);
    expect((await repo.listDueCards({ now: clock.now })).map((c) => c.cardId)).toEqual([cards[1].id, cards[0].id]); // most overdue first
  });

  it('does not reschedule on a duplicate (retried) answer', async () => {
    const { repo } = await repoAt('2026-10-26T09:00:00Z');
    const { deck, cards } = await deckWithCards(repo, 1);
    const s = await repo.startSession(deck.id, 'flashcards');
    await repo.recordAttempt(s.id, cards[0].id, 'know');
    const before = await repo.getCardSchedule(cards[0].id);
    await repo.recordAttempt(s.id, cards[0].id, 'know');
    expect(await repo.getCardSchedule(cards[0].id)).toEqual(before);
  });

  it('leaves the schedule untouched when saving the answer fails', async () => {
    const { db, repo } = await repoAt('2026-10-26T09:00:00Z');
    const { deck, cards } = await deckWithCards(repo, 1);
    const s = await repo.startSession(deck.id, 'flashcards');
    const realRun = db.runAsync.bind(db);
    jest.spyOn(db, 'runAsync').mockImplementation(async (sql, params) => {
      if (sql.includes('UPDATE study_sessions SET updated_at')) throw new Error('disk full');
      return realRun(sql, params);
    });
    await expect(repo.recordAttempt(s.id, cards[0].id, 'know')).rejects.toThrow('disk full');
    jest.restoreAllMocks();
    expect(await repo.getCardSchedule(cards[0].id)).toBeNull();
  });

  it('can start a session of only the due cards', async () => {
    const { repo, advance } = await repoAt('2026-10-26T09:00:00Z');
    const { deck, cards } = await deckWithCards(repo, 3);
    const first = await repo.startSession(deck.id, 'flashcards');
    await repo.recordAttempt(first.id, cards[0].id, 'know'); // due tomorrow
    await repo.recordAttempt(first.id, cards[1].id, 'review'); // due in 10 min
    await repo.completeSession(first.id);
    advance(15);
    const due = await repo.startSession(deck.id, 'flashcards', { dueOnly: true });
    expect((await repo.getSessionDetail(due.id)).items.map((i) => i.itemId)).toEqual([cards[1].id, cards[2].id]);
    await expect(repo.startSession(deck.id, 'quiz', { dueOnly: true })).rejects.toThrow();
  });

  it('resets one card or a whole deck back to new', async () => {
    const { repo, clock } = await repoAt('2026-10-26T09:00:00Z');
    const { deck, cards } = await deckWithCards(repo, 2);
    const s = await repo.startSession(deck.id, 'flashcards');
    await repo.recordAttempt(s.id, cards[0].id, 'know');
    await repo.recordAttempt(s.id, cards[1].id, 'know');
    await repo.resetCardSchedule(cards[0].id);
    expect(await repo.getCardSchedule(cards[0].id)).toBeNull();
    expect((await repo.listDueCards({ now: clock.now })).map((c) => c.cardId)).toEqual([cards[0].id]);
    expect(await repo.resetDeckSchedule(deck.id)).toBe(1);
    expect(await repo.listDueCards({ now: clock.now })).toHaveLength(2);
    // History is kept: resetting doesn't erase answers.
    expect((await repo.getSessionDetail(s.id)).score.answered).toBe(2);
  });

  it('rebuilds schedules from saved answers exactly as live updates produced them', async () => {
    const { db, repo, advance } = await repoAt('2026-10-20T09:00:00Z');
    const { deck, cards } = await deckWithCards(repo, 2);
    for (const results of [['know', 'review'], ['know', 'know'], ['review', 'know']] as const) {
      const s = await repo.startSession(deck.id, 'flashcards');
      await repo.recordAttempt(s.id, cards[0].id, results[0]);
      advance(1);
      await repo.recordAttempt(s.id, cards[1].id, results[1]);
      await repo.completeSession(s.id);
      advance(24 * 60);
    }
    const live = [await repo.getCardSchedule(cards[0].id), await repo.getCardSchedule(cards[1].id)];
    db.raw.exec('DELETE FROM card_reviews');
    expect(await repo.rebuildSchedules()).toBe(2);
    const rebuilt = [await repo.getCardSchedule(cards[0].id), await repo.getCardSchedule(cards[1].id)];
    expect(rebuilt).toEqual(live);
  });

  it('cascades schedules when a card or deck is deleted', async () => {
    const { db, repo } = await repoAt('2026-10-26T09:00:00Z');
    const { deck, cards } = await deckWithCards(repo, 2);
    const s = await repo.startSession(deck.id, 'flashcards');
    await repo.recordAttempt(s.id, cards[0].id, 'know');
    await repo.deleteFlashcard(cards[0].id);
    const count = () => Number((db.raw.prepare('SELECT COUNT(*) AS n FROM card_reviews').get() as { n: number }).n);
    expect(count()).toBe(0);
  });
});

describe('progress values match persisted data', () => {
  it('derives every dashboard number from the saved answers and sessions', async () => {
    const { db, repo, advance } = await repoAt('2026-10-26T03:00:00Z');
    const { deck, cards } = await deckWithCards(repo, 3);
    const question = await repo.createQuizQuestion(deck.id, {
      type: 'true_false',
      question: 'Cells have DNA.',
      options: ['True', 'False'],
      correctAnswerIndex: 0,
    });
    const s1 = await repo.startSession(deck.id, 'flashcards');
    await repo.recordAttempt(s1.id, cards[0].id, 'know');
    await repo.recordAttempt(s1.id, cards[1].id, 'review');
    await repo.completeSession(s1.id);
    advance(30);
    const s2 = await repo.startSession(deck.id, 'quiz');
    await repo.recordAttempt(s2.id, question.id, '1'); // wrong
    await repo.completeSession(s2.id);

    const activity = await repo.listActivity();
    const sessions = (await repo.listCompletedSessions()).length;
    const p = computeProgress({ attempts: activity, sessionsCompleted: sessions, dailyGoal: 20, now: new Date('2026-10-26T12:00:00Z'), timeZone: 'Asia/Kolkata' });

    const sql = (q: string) => Number((db.raw.prepare(q).get() as { n: number }).n);
    expect(p.totals).toEqual({
      cardsReviewed: sql("SELECT COUNT(*) AS n FROM study_attempts a JOIN study_sessions s ON s.id = a.session_id WHERE s.mode = 'flashcards'"),
      quizAnswers: sql("SELECT COUNT(*) AS n FROM study_attempts a JOIN study_sessions s ON s.id = a.session_id WHERE s.mode = 'quiz'"),
      sessionsCompleted: sql("SELECT COUNT(*) AS n FROM study_sessions WHERE status = 'completed'"),
    });
    expect(p.totals).toEqual({ cardsReviewed: 2, quizAnswers: 1, sessionsCompleted: 2 });
    expect(p.quizAccuracy).toEqual({ percent: 0, correct: 0, answered: 1 });
    expect(p.goal).toMatchObject({ cardsReviewedToday: 2, target: 20, met: false, percent: 10 });
    expect(p.streakDays).toBe(1);
    expect(p.weakTopics).toEqual([{ deckId: deck.id, title: 'Biology', subject: 'Science', answers: 3, incorrect: 2, missRate: 67 }]);
  });

  it('shows empty progress for a new user', async () => {
    const { repo } = await openTestRepository();
    expect(await repo.listActivity()).toEqual([]);
    expect(await repo.listDueByDeck()).toEqual([]);
  });
});
