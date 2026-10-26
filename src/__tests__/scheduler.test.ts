import {
  AGAIN_INTERVAL_MINUTES,
  MAX_INTERVAL_DAYS,
  intervalDaysFor,
  isDue,
  nextReviewState,
  replayReviews,
  type ReviewState,
} from '@/study/scheduler';

const T0 = '2026-10-26T09:00:00.000Z';
const minutesAfter = (iso: string, minutes: number) => new Date(Date.parse(iso) + minutes * 60_000).toISOString();
const daysAfter = (iso: string, days: number) => minutesAfter(iso, days * 1440);

describe('spaced-repetition scheduler', () => {
  it('treats new cards as due immediately', () => {
    expect(isDue(null, new Date(T0))).toBe(true);
  });

  it('schedules "review again" a short interval later and counts a lapse', () => {
    const s = nextReviewState(null, 'review', T0);
    expect(s).toEqual({
      repetitions: 0,
      lapses: 1,
      intervalMinutes: AGAIN_INTERVAL_MINUTES,
      dueAt: minutesAfter(T0, 10),
      lastReviewedAt: T0,
      lastResult: 'review',
    });
    expect(isDue(s, new Date(minutesAfter(T0, 9)))).toBe(false);
    expect(isDue(s, new Date(minutesAfter(T0, 10)))).toBe(true);
  });

  it('extends intervals with each correct review in a row: 1, 3, 7, 16, 35 days, then doubling to 180', () => {
    let state: ReviewState | null = null;
    let at = T0;
    const days: number[] = [];
    for (let i = 0; i < 9; i += 1) {
      state = nextReviewState(state, 'know', at);
      days.push(state.intervalMinutes / 1440);
      expect(state.dueAt).toBe(daysAfter(at, state.intervalMinutes / 1440));
      at = state.dueAt; // review exactly when due
    }
    expect(days).toEqual([1, 3, 7, 16, 35, 70, 140, 180, 180]);
    expect(state!.repetitions).toBe(9);
  });

  it('a lapse restarts the run of correct reviews but keeps the lapse count', () => {
    let s = nextReviewState(null, 'know', T0); // 1 day
    s = nextReviewState(s, 'know', s.dueAt); // 3 days
    s = nextReviewState(s, 'review', s.dueAt); // back to 10 minutes
    expect(s).toMatchObject({ repetitions: 0, lapses: 1, intervalMinutes: 10 });
    s = nextReviewState(s, 'know', s.dueAt);
    expect(s).toMatchObject({ repetitions: 1, lapses: 1, intervalMinutes: 1440 });
  });

  it('is deterministic, and replay matches step-by-step updates regardless of input order', () => {
    const reviews = [
      { result: 'know' as const, reviewedAt: T0 },
      { result: 'review' as const, reviewedAt: daysAfter(T0, 2) },
      { result: 'know' as const, reviewedAt: daysAfter(T0, 3) },
    ];
    const stepwise = reviews.reduce<ReviewState | null>((s, r) => nextReviewState(s, r.result, r.reviewedAt), null);
    expect(replayReviews(reviews)).toEqual(stepwise);
    expect(replayReviews([...reviews].reverse())).toEqual(stepwise);
    expect(replayReviews([])).toBeNull();
  });

  it('caps long intervals and rejects invalid times', () => {
    expect(intervalDaysFor(20, 400 * 1440)).toBe(MAX_INTERVAL_DAYS);
    expect(() => nextReviewState(null, 'know', 'not a date')).toThrow(RangeError);
  });

  it('stores due times as absolute UTC instants (unaffected by the device time zone)', () => {
    const s = nextReviewState(null, 'know', '2026-03-28T23:30:00.000Z'); // the night before EU clocks change
    expect(s.dueAt).toBe('2026-03-29T23:30:00.000Z'); // exactly 24 h later
  });
});
