/**
 * Spaced-repetition scheduler. Pure and deterministic: the same review history always
 * produces the same schedule. No UI, no clock (times are passed in), no randomness.
 *
 * The schedule (documented in docs/PROGRESS.md):
 * - A card with no reviews is new and due immediately.
 * - "Review again" (incorrect) resets the streak of correct reviews and makes the card
 *   due again in 10 minutes.
 * - "Know it" (correct) increases the interval. Successive correct reviews use
 *   1, 3, 7, 16 and 35 days; after that each correct review doubles the interval,
 *   up to 180 days.
 * - Due times are absolute UTC instants (review time + interval), so they don't depend
 *   on the device's time zone. "Due today" is decided by the caller in local time.
 * - A manual reset deletes a card's schedule, making it new (due now) again.
 */
export type ReviewResult = 'know' | 'review';

export type ReviewState = {
  /** Correct reviews in a row since the last "review again". */
  repetitions: number;
  /** Times the card was marked "review again". */
  lapses: number;
  intervalMinutes: number;
  /** ISO-8601 UTC instant when the card is next due. */
  dueAt: string;
  lastReviewedAt: string;
  lastResult: ReviewResult;
};

export const AGAIN_INTERVAL_MINUTES = 10;
export const SUCCESS_INTERVAL_DAYS = [1, 3, 7, 16, 35] as const;
export const MAX_INTERVAL_DAYS = 180;

const MINUTE_MS = 60_000;
const DAY_MINUTES = 24 * 60;

function addMinutes(iso: string, minutes: number): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) throw new RangeError(`Invalid review time: ${iso}`);
  return new Date(t + minutes * MINUTE_MS).toISOString();
}

/** Interval in days after the `repetitions`-th correct review in a row (1-based). */
export function intervalDaysFor(repetitions: number, previousIntervalMinutes: number): number {
  if (repetitions <= SUCCESS_INTERVAL_DAYS.length) return SUCCESS_INTERVAL_DAYS[repetitions - 1];
  const previousDays = previousIntervalMinutes / DAY_MINUTES;
  return Math.min(Math.max(previousDays, SUCCESS_INTERVAL_DAYS.at(-1)!) * 2, MAX_INTERVAL_DAYS);
}

export function nextReviewState(previous: ReviewState | null, result: ReviewResult, reviewedAt: string): ReviewState {
  const lapses = previous?.lapses ?? 0;
  if (result === 'review') {
    return {
      repetitions: 0,
      lapses: lapses + 1,
      intervalMinutes: AGAIN_INTERVAL_MINUTES,
      dueAt: addMinutes(reviewedAt, AGAIN_INTERVAL_MINUTES),
      lastReviewedAt: reviewedAt,
      lastResult: 'review',
    };
  }
  const repetitions = (previous?.repetitions ?? 0) + 1;
  const intervalMinutes = intervalDaysFor(repetitions, previous?.intervalMinutes ?? 0) * DAY_MINUTES;
  return {
    repetitions,
    lapses,
    intervalMinutes,
    dueAt: addMinutes(reviewedAt, intervalMinutes),
    lastReviewedAt: reviewedAt,
    lastResult: 'know',
  };
}

/** Replays a card's reviews in time order (ties keep input order). */
export function replayReviews(reviews: readonly { result: ReviewResult; reviewedAt: string }[]): ReviewState | null {
  return [...reviews]
    .map((r, i) => ({ ...r, i }))
    .sort((a, b) => Date.parse(a.reviewedAt) - Date.parse(b.reviewedAt) || a.i - b.i)
    .reduce<ReviewState | null>((state, r) => nextReviewState(state, r.result, r.reviewedAt), null);
}

/** New cards (no state) are due immediately. */
export function isDue(state: Pick<ReviewState, 'dueAt'> | null, now: Date): boolean {
  return state === null || Date.parse(state.dueAt) <= now.getTime();
}
