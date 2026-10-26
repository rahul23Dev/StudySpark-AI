/**
 * Session length, shown on the results screen. Progress statistics (goal, streak,
 * accuracy, weekly activity) live in progress.ts.
 */
export type CompletedSessionTimes = { startedAt: string; completedAt: string };

/** A session left open (e.g. phone put away) shouldn't count as hours of study. */
export const MAX_MINUTES_PER_SESSION = 60;

export function sessionMinutes({ startedAt, completedAt }: CompletedSessionTimes): number {
  const ms = Date.parse(completedAt) - Date.parse(startedAt);
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.min(ms / 60000, MAX_MINUTES_PER_SESSION);
}
