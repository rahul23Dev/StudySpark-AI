import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import ProgressScreen from '@/app/(tabs)/progress';
import NewQuestionScreen from '@/app/deck/[id]/question/new';
import DeckDetailScreen from '@/app/deck/[id]/index';
import StudySessionScreen from '@/app/session/[id]/index';
import SessionResultsScreen from '@/app/session/[id]/results';

import { mockRouter, resetMockRouter, setMockParams } from '../../test/expo-router-mock';
import { openTestRepository } from '../../test/node-sqlite';
import { renderScreen } from '../../test/render';

jest.mock('expo-router', () => jest.requireActual('../../test/expo-router-mock'));

beforeEach(() => resetMockRouter());

async function seeded() {
  const { db, repo } = await openTestRepository();
  const deck = await repo.createDeck({ title: 'Biology' });
  const cards = [
    await repo.createFlashcard(deck.id, { front: 'Cell', back: 'Unit of life' }),
    await repo.createFlashcard(deck.id, { front: 'DNA', back: 'Genetic code' }),
  ];
  const questions = [
    await repo.createQuizQuestion(deck.id, {
      type: 'multiple_choice',
      question: 'Which organ pumps blood?',
      options: ['Lungs', 'Liver', 'Heart'],
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

async function openSession(repo: Awaited<ReturnType<typeof seeded>>['repo'], sessionId: string) {
  setMockParams({ id: sessionId });
  await renderScreen(<StudySessionScreen />, repo);
}

describe('flashcard player', () => {
  it('reveals answers, records Know it / Review again and finishes with the saved score', async () => {
    const { repo, deck } = await seeded();
    const session = await repo.startSession(deck.id, 'flashcards');
    await openSession(repo, session.id);

    expect(await screen.findByText('Card 1 of 2')).toBeTruthy();
    expect(screen.getByText('Cell')).toBeTruthy();
    expect(screen.queryByText('Unit of life')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Know it' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Show answer' }));
    expect(screen.getByText('Unit of life')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Know it' }));

    expect(await screen.findByText('Card 2 of 2')).toBeTruthy(); // moved on automatically
    await fireEvent.press(screen.getByRole('button', { name: 'Question: DNA' })); // tapping the card reveals too
    await fireEvent.press(screen.getByRole('button', { name: 'Review again' }));

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith(`/session/${session.id}/results`));
    const saved = await repo.getSession(session.id);
    expect(saved).toMatchObject({ status: 'completed', scoreCorrect: 1, scoreTotal: 2 });
  });

  it('navigates with previous / next and keeps answers on revisit', async () => {
    const { repo, deck, cards } = await seeded();
    const session = await repo.startSession(deck.id, 'flashcards');
    await repo.recordAttempt(session.id, cards[0].id, 'know');
    await openSession(repo, session.id);

    expect(await screen.findByText('Card 2 of 2')).toBeTruthy(); // resumes at first unanswered
    expect(screen.getByRole('button', { name: 'Go to next card' }).props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByRole('button', { name: 'Go to previous card' }));
    expect(screen.getByText('Card 1 of 2')).toBeTruthy();
    expect(screen.getByText('You knew this one')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show answer' })).toBeNull();
  });

  it('surfaces a failed save and saves once when retried', async () => {
    const { repo, deck } = await seeded();
    const session = await repo.startSession(deck.id, 'flashcards');
    const spy = jest.spyOn(repo, 'recordAttempt').mockRejectedValueOnce(new Error('disk full'));
    await openSession(repo, session.id);

    await fireEvent.press(await screen.findByRole('button', { name: 'Show answer' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Know it' }));
    expect(await screen.findByText(/Couldn't save your answer/)).toBeTruthy();
    expect(screen.getByText('Card 1 of 2')).toBeTruthy(); // stayed on the card

    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Card 2 of 2')).toBeTruthy();
    expect(spy).toHaveBeenCalledTimes(2);
    expect((await repo.getSessionDetail(session.id)).score).toMatchObject({ answered: 1, correct: 1 });
  });

  it('ignores a second tap while the first answer is still saving', async () => {
    const { repo, deck } = await seeded();
    const session = await repo.startSession(deck.id, 'flashcards');
    const realRecord = repo.recordAttempt;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const spy = jest.spyOn(repo, 'recordAttempt').mockImplementation(async (...args) => {
      await gate; // hold the save open, like a slow disk
      return realRecord(...args);
    });
    await openSession(repo, session.id);
    await fireEvent.press(await screen.findByRole('button', { name: 'Show answer' }));

    // fireEvent.press resolves when the handler's save does, so the first tap is left
    // pending (its act() has already finished) while the second tap happens.
    const firstTap = fireEvent.press(screen.getByRole('button', { name: 'Know it' }));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    await fireEvent.press(screen.getByRole('button', { name: 'Review again' })); // second tap during the save
    release();
    await firstTap;

    expect(await screen.findByText('Card 2 of 2')).toBeTruthy();
    expect(spy).toHaveBeenCalledTimes(1);
    expect((await repo.getSessionDetail(session.id)).score).toMatchObject({ answered: 1, correct: 1 });
  });
});

describe('quiz', () => {
  it('grades answers with immediate feedback and explanations', async () => {
    const { repo, deck } = await seeded();
    const session = await repo.startSession(deck.id, 'quiz');
    await openSession(repo, session.id);

    expect(await screen.findByText('Which organ pumps blood?')).toBeTruthy();
    const check = screen.getByRole('button', { name: 'Check answer' });
    expect(check.props.accessibilityState).toMatchObject({ disabled: true });

    await fireEvent.press(screen.getByRole('radio', { name: 'A: Lungs' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Check answer' }));
    expect(await screen.findByText('Not quite')).toBeTruthy();
    expect(screen.getByText('The answer is C: Heart.')).toBeTruthy();
    expect(screen.getByText('The heart is a muscular pump.')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'C: Heart, correct answer' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'A: Lungs, your answer, incorrect' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Next question' }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'A: True' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Check answer' }));
    expect(await screen.findByText('Correct!')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'See results' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith(`/session/${session.id}/results`));
    expect(await repo.getSession(session.id)).toMatchObject({ scoreCorrect: 1, scoreTotal: 2 });
  });

  it('ends a session early only after confirming', async () => {
    const { repo, deck } = await seeded();
    const session = await repo.startSession(deck.id, 'quiz');
    await openSession(repo, session.id);
    await fireEvent.press(await screen.findByRole('button', { name: 'End' }));
    await fireEvent.press(within(screen.getByTestId('confirm-dialog')).getByRole('button', { name: 'End session' }));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect((await repo.getSession(session.id))?.status).toBe('abandoned');
  });

  it('save & exit keeps the session active to resume later', async () => {
    const { repo, deck } = await seeded();
    const session = await repo.startSession(deck.id, 'quiz');
    await openSession(repo, session.id);
    await fireEvent.press(await screen.findByRole('button', { name: 'Save & exit' }));
    expect(mockRouter.back).toHaveBeenCalled();
    expect((await repo.getSession(session.id))?.status).toBe('active');
  });
});

describe('results', () => {
  it('shows the score from saved answers and reviews the incorrect ones', async () => {
    const { repo, deck, questions } = await seeded();
    const session = await repo.startSession(deck.id, 'quiz');
    await repo.recordAttempt(session.id, questions[0].id, '0');
    await repo.recordAttempt(session.id, questions[1].id, '0');
    await repo.completeSession(session.id);
    setMockParams({ id: session.id });
    await renderScreen(<SessionResultsScreen />, repo);

    expect(await screen.findByLabelText('Score: 1 out of 2, 50 percent')).toBeTruthy();
    expect(screen.getByText('REVIEW (1)')).toBeTruthy();
    expect(screen.getByText('Your answer: Lungs')).toBeTruthy();
    expect(screen.getByText('Correct answer: Heart')).toBeTruthy();
    expect(screen.queryByText('Plants make oxygen.')).toBeNull(); // answered correctly, not in review
  });

  it('celebrates a perfect score and can study again', async () => {
    const { repo, deck, cards } = await seeded();
    const session = await repo.startSession(deck.id, 'flashcards');
    for (const card of cards) await repo.recordAttempt(session.id, card.id, 'know');
    await repo.completeSession(session.id);
    setMockParams({ id: session.id });
    await renderScreen(<SessionResultsScreen />, repo);

    expect(await screen.findByText('Perfect score!')).toBeTruthy();
    expect(screen.queryByText(/REVIEW/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Study again' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith(expect.stringMatching(/^\/session\//)));
    expect(await repo.getActiveSession(deck.id, 'flashcards')).not.toBeNull();
  });

  it('opens results instead of the player for a completed session', async () => {
    const { repo, deck } = await seeded();
    const session = await repo.startSession(deck.id, 'quiz');
    await repo.completeSession(session.id);
    await openSession(repo, session.id);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith(`/session/${session.id}/results`));
  });
});

describe('deck study panel and question editor', () => {
  it('starts, then offers to resume, a session', async () => {
    const { repo, deck } = await seeded();
    setMockParams({ id: deck.id });
    await renderScreen(<DeckDetailScreen />, repo);
    await fireEvent.press(await screen.findByRole('button', { name: 'Take quiz' }));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith(expect.stringMatching(/^\/session\//)));
    const active = await repo.getActiveSession(deck.id, 'quiz');
    expect(mockRouter.push).toHaveBeenCalledWith(`/session/${active!.id}`);
  });

  it('shows resume for a session in progress', async () => {
    const { repo, deck, questions } = await seeded();
    const session = await repo.startSession(deck.id, 'quiz');
    await repo.recordAttempt(session.id, questions[0].id, '2');
    setMockParams({ id: deck.id });
    await renderScreen(<DeckDetailScreen />, repo);
    expect(await screen.findByText('In progress · 1 of 2 answered')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Resume quiz' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/session/${session.id}`);
  });

  it('creates a multiple-choice question', async () => {
    const { repo, deck } = await seeded();
    setMockParams({ id: deck.id });
    await renderScreen(<NewQuestionScreen />, repo);
    await fireEvent.changeText(screen.getByLabelText('Question'), 'Largest planet?');
    await fireEvent.changeText(screen.getByLabelText('Option 1'), 'Mars');
    await fireEvent.changeText(screen.getByLabelText('Option 2'), 'Jupiter');
    await fireEvent.press(screen.getByRole('radio', { name: 'Mark option 2 as correct' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save question' }));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    const saved = (await repo.listQuizQuestions(deck.id)).at(-1);
    // Blank rows 3 and 4 were dropped, and the answer index remapped.
    expect(saved).toMatchObject({ question: 'Largest planet?', options: ['Mars', 'Jupiter'], correctAnswerIndex: 1 });
  });

  it('requires a correct answer to be chosen', async () => {
    const { repo, deck } = await seeded();
    setMockParams({ id: deck.id });
    await renderScreen(<NewQuestionScreen />, repo);
    await fireEvent.press(screen.getByRole('radio', { name: 'True or false' }));
    await fireEvent.changeText(screen.getByLabelText('Question'), 'Water boils at 100°C at sea level.');
    await fireEvent.press(screen.getByRole('button', { name: 'Save question' }));
    expect(await screen.findByText('Choose which option is correct.')).toBeTruthy();
    expect(mockRouter.back).not.toHaveBeenCalled();
  });
});

describe('progress tab', () => {
  it('shows zeros with no sessions and real numbers after one', async () => {
    const { repo, deck, cards } = await seeded();
    const session = await repo.startSession(deck.id, 'flashcards');
    await repo.recordAttempt(session.id, cards[0].id, 'know');
    await repo.completeSession(session.id);
    await renderScreen(<ProgressScreen />, repo);
    expect(await screen.findByLabelText('Sessions completed: 1')).toBeTruthy();
    expect(screen.getByLabelText('Day streak: 0')).toBeTruthy(); // test clock is in 2026-01-01, not today
  });

  it('starts empty', async () => {
    const { repo } = await openTestRepository();
    await renderScreen(<ProgressScreen />, repo);
    expect(await screen.findByLabelText('Sessions completed: 0')).toBeTruthy();
    expect(screen.getByText('0 minutes this week')).toBeTruthy();
  });
});
