import {
  addDays,
  computeProgress,
  dayKeyOf,
  streakFromDays,
  weekdayIndex,
  type ActivityAttempt,
} from '@/study/progress';

const KOLKATA = 'Asia/Kolkata'; // UTC+5:30, no DST
const NEW_YORK = 'America/New_York'; // UTC-4/-5 with DST
const LONDON = 'Europe/London';

const card = (answeredAt: string, isCorrect = true, deck = 'bio'): ActivityAttempt => ({
  answeredAt,
  mode: 'flashcards',
  isCorrect,
  deckId: deck,
  deckTitle: deck === 'bio' ? 'Biology' : 'Chemistry',
  deckSubject: 'Science',
});
const quiz = (answeredAt: string, isCorrect: boolean, deck = 'bio'): ActivityAttempt => ({ ...card(answeredAt, isCorrect, deck), mode: 'quiz' });

const progress = (attempts: ActivityAttempt[], now: string, timeZone: string, dailyGoal = 3) =>
  computeProgress({ attempts, sessionsCompleted: 0, dailyGoal, now: new Date(now), timeZone });

describe('calendar days', () => {
  it('assigns instants to local dates per time zone', () => {
    const instant = new Date('2026-10-25T19:00:00Z'); // 00:30 on the 26th in India, 15:00 on the 25th in New York
    expect(dayKeyOf(instant, KOLKATA)).toBe('2026-10-26');
    expect(dayKeyOf(instant, NEW_YORK)).toBe('2026-10-25');
  });

  it('does date arithmetic across month, year and leap-day boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09'); // US DST change day is still one day
    expect(weekdayIndex('2026-10-26')).toBe(0); // Monday
    expect(weekdayIndex('2026-11-01')).toBe(6); // Sunday
  });
});

describe('streaks', () => {
  it('counts consecutive local days ending today, or yesterday if nothing yet today', () => {
    const days = new Set(['2026-10-24', '2026-10-25', '2026-10-26']);
    expect(streakFromDays(days, '2026-10-26')).toBe(3);
    expect(streakFromDays(days, '2026-10-27')).toBe(3); // today not studied yet: streak still alive
    expect(streakFromDays(days, '2026-10-28')).toBe(0); // missed a whole day
    expect(streakFromDays(new Set(), '2026-10-26')).toBe(0);
  });

  it('keeps a streak across local midnight (study at 23:55, then at 00:05)', () => {
    const attempts = [card('2026-10-25T18:25:00Z'), card('2026-10-25T18:35:00Z')]; // 23:55 and 00:05 IST
    const p = progress(attempts, '2026-10-25T18:40:00Z', KOLKATA);
    expect(p.today).toBe('2026-10-26');
    expect(p.streakDays).toBe(2);
    expect(p.goal.cardsReviewedToday).toBe(1); // only the 00:05 review counts for today
  });

  it('evaluates the same history in whatever time zone the device is now in (travel)', () => {
    // Studied 20:00 New York time on two evenings = 00:00/01:00 UTC the next day.
    const attempts = [card('2026-10-24T00:00:00Z'), card('2026-10-25T00:00:00Z')];
    // Still in New York on the 25th: those are the 23rd and 24th; yesterday was studied.
    expect(progress(attempts, '2026-10-25T16:00:00Z', NEW_YORK).streakDays).toBe(2);
    // Flew to India: the same instants are the 24th and 25th there, and "today" is the 25th.
    const india = progress(attempts, '2026-10-25T16:00:00Z', KOLKATA);
    expect(india.today).toBe('2026-10-25');
    expect(india.streakDays).toBe(2);
    expect(india.goal.cardsReviewedToday).toBe(1);
  });

  it('is unaffected by daylight-saving changes', () => {
    // London clocks go back at 02:00 on 25 Oct 2026; one study session per local day around it.
    const attempts = [card('2026-10-24T21:00:00Z'), card('2026-10-25T21:00:00Z'), card('2026-10-26T21:00:00Z')];
    expect(progress(attempts, '2026-10-26T22:00:00Z', LONDON).streakDays).toBe(3);
    // New York springs forward on 8 Mar 2026: 23:30 local on the 7th and 8th.
    const spring = [card('2026-03-08T04:30:00Z'), card('2026-03-09T03:30:00Z')];
    expect(progress(spring, '2026-03-09T04:00:00Z', NEW_YORK).streakDays).toBe(2);
  });
});

describe('computeProgress', () => {
  it('handles no activity', () => {
    const p = progress([], '2026-10-26T12:00:00Z', KOLKATA);
    expect(p).toMatchObject({
      hasActivity: false,
      streakDays: 0,
      goal: { target: 3, cardsReviewedToday: 0, met: false, percent: 0 },
      totals: { cardsReviewed: 0, quizAnswers: 0, sessionsCompleted: 0 },
      quizAccuracy: { percent: null, correct: 0, answered: 0 },
      weakTopics: [],
    });
    expect(p.week.map((d) => d.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(p.week[0].day).toBe('2026-10-26');
  });

  it('tracks the daily goal from cards reviewed today only', () => {
    const today = ['2026-10-26T04:00:00Z', '2026-10-26T05:00:00Z', '2026-10-26T06:00:00Z'].map((t) => card(t, false));
    const p = progress([...today, quiz('2026-10-26T06:30:00Z', true), card('2026-10-25T05:00:00Z')], '2026-10-26T12:00:00Z', KOLKATA);
    expect(p.goal).toEqual({ target: 3, cardsReviewedToday: 3, met: true, percent: 100 });
    expect(p.quizAnswersToday).toBe(1);
  });

  it('computes quiz accuracy as correct / answered quiz questions', () => {
    const attempts = [quiz('2026-10-20T05:00:00Z', true), quiz('2026-10-21T05:00:00Z', false), quiz('2026-10-21T06:00:00Z', true), card('2026-10-21T06:00:00Z', false)];
    expect(progress(attempts, '2026-10-26T12:00:00Z', KOLKATA).quizAccuracy).toEqual({ percent: 67, correct: 2, answered: 3 });
  });

  it('builds the weekly chart for Monday to Sunday of the local week', () => {
    const attempts = [card('2026-10-26T04:00:00Z'), quiz('2026-10-26T04:10:00Z', true), card('2026-10-28T04:00:00Z'), card('2026-10-25T04:00:00Z')];
    const p = progress(attempts, '2026-10-28T12:00:00Z', KOLKATA);
    expect(p.week.map((d) => [d.label, d.cards, d.quiz])).toEqual([
      ['Mon', 1, 1],
      ['Tue', 0, 0],
      ['Wed', 1, 0],
      ['Thu', 0, 0],
      ['Fri', 0, 0],
      ['Sat', 0, 0],
      ['Sun', 0, 0],
    ]); // last Sunday's card is not in this week
  });

  it('derives weak topics from real wrong answers in the last 30 days', () => {
    const bio = [card('2026-10-20T05:00:00Z', false), card('2026-10-20T05:01:00Z', false), card('2026-10-20T05:02:00Z', true), quiz('2026-10-21T05:00:00Z', false)];
    const chem = [quiz('2026-10-22T05:00:00Z', false, 'chem'), quiz('2026-10-22T05:01:00Z', true, 'chem'), quiz('2026-10-22T05:02:00Z', true, 'chem')];
    const old = [card('2026-08-01T05:00:00Z', false, 'chem'), card('2026-08-01T05:01:00Z', false, 'chem')]; // outside window
    const perfect = ['a', 'b', 'c'].map((_, i) => card(`2026-10-23T05:0${i}:00Z`, true, 'phys'));
    const p = progress([...bio, ...chem, ...old, ...perfect], '2026-10-26T12:00:00Z', KOLKATA);
    expect(p.weakTopics).toEqual([
      { deckId: 'bio', title: 'Biology', subject: 'Science', answers: 4, incorrect: 3, missRate: 75 },
      { deckId: 'chem', title: 'Chemistry', subject: 'Science', answers: 3, incorrect: 1, missRate: 33 },
    ]);
  });

  it('ignores answers timestamped in the future (clock changes)', () => {
    const p = progress([card('2026-10-27T05:00:00Z')], '2026-10-26T12:00:00Z', KOLKATA);
    expect(p.totals.cardsReviewed).toBe(0);
  });
});
