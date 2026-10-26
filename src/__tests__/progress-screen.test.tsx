import { fireEvent, screen, within } from '@testing-library/react-native';
import { randomUUID } from 'node:crypto';

import ProgressScreen from '@/app/(tabs)/progress';
import EditCardScreen from '@/app/deck/[id]/card/[cardId]';
import DeckDetailScreen from '@/app/deck/[id]/index';
import { migrateAsync } from '@/data/migrations';
import { createStudyRepository } from '@/data/repository';

import { mockRouter, resetMockRouter, setMockParams } from '../../test/expo-router-mock';
import { openTestDatabase } from '../../test/node-sqlite';
import { renderScreen } from '../../test/render';

jest.mock('expo-router', () => jest.requireActual('../../test/expo-router-mock'));

beforeEach(() => resetMockRouter());

/** The screen reads the real clock, so answers are saved at the real "now" too. */
async function openRepo() {
  const db = openTestDatabase();
  await migrateAsync(db);
  return createStudyRepository(db, { uuid: randomUUID, now: () => new Date().toISOString() });
}

async function seed(repo: Awaited<ReturnType<typeof openRepo>>) {
  const deck = await repo.createDeck({ title: 'Biology', subject: 'Science' });
  const cards = [];
  for (const front of ['Cell', 'DNA', 'ATP']) cards.push(await repo.createFlashcard(deck.id, { front, back: `${front}!` }));
  const questions = [
    await repo.createQuizQuestion(deck.id, {
      type: 'true_false',
      question: 'Plants make oxygen.',
      options: ['True', 'False'],
      correctAnswerIndex: 0,
    }),
    await repo.createQuizQuestion(deck.id, {
      type: 'true_false',
      question: 'The sun is a planet.',
      options: ['True', 'False'],
      correctAnswerIndex: 1,
    }),
  ];
  return { deck, cards, questions };
}

describe('Progress dashboard', () => {
  it('shows an empty state with no fabricated numbers', async () => {
    const repo = await openRepo();
    await renderScreen(<ProgressScreen />, repo);
    expect(await screen.findByText('No study activity yet')).toBeTruthy();
    expect(screen.getByText('0 of 20 cards today')).toBeTruthy();
    expect(screen.getByLabelText('Study streak: 0 days')).toBeTruthy();
    expect(screen.getByLabelText('Cards reviewed: 0')).toBeTruthy();
    expect(screen.getByLabelText('Sessions completed: 0')).toBeTruthy();
    expect(screen.getByText('No quiz answers yet. Take a quiz to see your accuracy.')).toBeTruthy();
    expect(screen.getByText(/Nothing is due right now/)).toBeTruthy();
    expect(screen.getByText('Decks you find tricky will show up here.')).toBeTruthy();
  });

  it('matches the saved answers, sessions and goal', async () => {
    const repo = await openRepo();
    const { deck, cards, questions } = await seed(repo);
    const flash = await repo.startSession(deck.id, 'flashcards');
    await repo.recordAttempt(flash.id, cards[0].id, 'know');
    await repo.recordAttempt(flash.id, cards[1].id, 'review');
    await repo.recordAttempt(flash.id, cards[2].id, 'review');
    await repo.completeSession(flash.id);
    const quiz = await repo.startSession(deck.id, 'quiz');
    await repo.recordAttempt(quiz.id, questions[0].id, '0');
    await repo.recordAttempt(quiz.id, questions[1].id, '0');
    await repo.completeSession(quiz.id);

    await renderScreen(<ProgressScreen />, repo, { dailyGoal: 10 });
    expect(await screen.findByText('3 of 10 cards today')).toBeTruthy();
    expect(screen.getByText('7 more cards to reach your goal.')).toBeTruthy();
    expect(screen.getByText('Plus 2 quiz answers today.')).toBeTruthy();
    expect(screen.getByLabelText('Study streak: 1 day')).toBeTruthy();
    expect(screen.getByLabelText('Cards reviewed: 3')).toBeTruthy();
    expect(screen.getByLabelText('Sessions completed: 2')).toBeTruthy();
    expect(screen.getByLabelText('Quiz accuracy 50 percent')).toBeTruthy();
    expect(screen.getByText(/1 correct out of 2 answered questions/)).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Daily goal' }).props.accessibilityValue).toMatchObject({ now: 3, max: 10 });
    // 3 wrong (2 "review again" + 1 quiz) of 5 answers.
    expect(screen.getByText('Missed 3 of 5 answers (60%) in the last 30 days')).toBeTruthy();
    expect(screen.queryByText('No study activity yet')).toBeNull();
    // Every card was just reviewed, so nothing is due yet.
    expect(screen.getByText(/Nothing is due right now/)).toBeTruthy();
  });

  it('starts a review of due cards from the due list', async () => {
    const repo = await openRepo();
    const { deck } = await seed(repo);
    await renderScreen(<ProgressScreen />, repo);
    expect(await screen.findByText('3 new')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Review' }));
    const session = await repo.getActiveSession(deck.id, 'flashcards');
    expect(session).not.toBeNull();
    expect(mockRouter.push).toHaveBeenCalledWith(`/session/${session!.id}`);
    expect((await repo.getSessionDetail(session!.id)).items).toHaveLength(3);
  });

  it('labels the weekly chart for screen readers', async () => {
    const repo = await openRepo();
    await renderScreen(<ProgressScreen />, repo);
    const chart = await screen.findByLabelText(/^This week: Mon 0 cards, 0 quiz answers/);
    expect(within(chart).getByText('Sun')).toBeTruthy();
  });
});

describe('spaced review on the deck and card screens', () => {
  it('reviews only due cards and resets the deck schedule after confirming', async () => {
    const repo = await openRepo();
    const { deck, cards } = await seed(repo);
    const s = await repo.startSession(deck.id, 'flashcards');
    await repo.recordAttempt(s.id, cards[0].id, 'know');
    await repo.completeSession(s.id);

    setMockParams({ id: deck.id });
    await renderScreen(<DeckDetailScreen />, repo);
    expect(await screen.findByText('2 new to review now')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Review due cards' }));
    const review = await repo.getActiveSession(deck.id, 'flashcards');
    expect((await repo.getSessionDetail(review!.id)).items.map((i) => i.itemId)).toEqual([cards[1].id, cards[2].id]);

    await fireEvent.press(screen.getByRole('button', { name: 'Reset schedule' }));
    await fireEvent.press(within(screen.getByTestId('confirm-dialog')).getByRole('button', { name: 'Reset schedule' }));
    expect(await screen.findByText('Schedule reset. 1 card is new again.')).toBeTruthy();
    expect(await repo.getCardSchedule(cards[0].id)).toBeNull();
    expect(await screen.findByText('3 new to review now')).toBeTruthy();
    // History is kept.
    expect((await repo.listActivity()).length).toBe(1);
  });

  it('shows and resets one card schedule', async () => {
    const repo = await openRepo();
    const { deck, cards } = await seed(repo);
    const s = await repo.startSession(deck.id, 'flashcards');
    await repo.recordAttempt(s.id, cards[0].id, 'review');

    setMockParams({ id: deck.id, cardId: cards[0].id });
    await renderScreen(<EditCardScreen />, repo);
    expect(await screen.findByText(/^Due in 10 minutes · 0 correct in a row · 1 lapse/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: "Reset this card's schedule" }));
    expect(await screen.findByText('Schedule reset. This card is new again.')).toBeTruthy();
    expect(screen.getByText('New card · due now')).toBeTruthy();
    expect(await repo.getCardSchedule(cards[0].id)).toBeNull();
  });
});
