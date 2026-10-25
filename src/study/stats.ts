/**
 * Study statistics computed from saved, completed sessions. Pure: `now` is passed in.
 * Days and weeks use the device's local time; weeks start on Monday.
 */
export type CompletedSessionTimes = { startedAt: string; completedAt: string };

/** A session left open (e.g. phone put away) shouldn't count as hours of study. */
export const MAX_MINUTES_PER_SESSION = 60;

export type StudyStats = {
  sessionsCompleted: number;
  streakDays: number;
  minutesThisWeek: number;
  minutesThisMonth: number;
  /** Mon..Sun of the current week. */
  week: { label: string; minutes: number }[];
  /** The last four weeks, oldest first, ending with the current week. */
  month: { label: string; minutes: number }[];
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function sessionMinutes({ startedAt, completedAt }: CompletedSessionTimes): number {
  const ms = Date.parse(completedAt) - Date.parse(startedAt);
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.min(ms / 60000, MAX_MINUTES_PER_SESSION);
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/** Monday 00:00 (local) of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  const day = startOfDay(d);
  return addDays(day, -((day.getDay() + 6) % 7));
}

/** Consecutive days with a completed session, ending today (or yesterday, if nothing yet today). */
export function streakDays(completedAt: readonly string[], now: Date): number {
  const days = new Set(completedAt.map((iso) => dayKey(new Date(iso))));
  let cursor = startOfDay(now);
  if (!days.has(dayKey(cursor))) cursor = addDays(cursor, -1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function computeStudyStats(sessions: readonly CompletedSessionTimes[], now: Date): StudyStats {
  const weekStart = startOfWeek(now);
  const week = DAY_LABELS.map((label) => ({ label, minutes: 0 }));
  const month = [3, 2, 1, 0].map((ago) => ({ label: ago === 0 ? 'This wk' : `${ago} wk ago`, minutes: 0 }));
  const monthStart = addDays(weekStart, -21);

  for (const session of sessions) {
    const minutes = sessionMinutes(session);
    const day = startOfDay(new Date(session.completedAt));
    if (day > now) continue; // ignore clock-skewed future sessions
    const daysFromWeekStart = Math.round((day.getTime() - weekStart.getTime()) / 86400000);
    if (daysFromWeekStart >= 0 && daysFromWeekStart < 7) week[daysFromWeekStart].minutes += minutes;
    const daysFromMonthStart = Math.round((day.getTime() - monthStart.getTime()) / 86400000);
    if (daysFromMonthStart >= 0 && daysFromMonthStart < 28) month[Math.floor(daysFromMonthStart / 7)].minutes += minutes;
  }

  const round = (buckets: { label: string; minutes: number }[]) =>
    buckets.map((b) => ({ ...b, minutes: Math.round(b.minutes) }));
  const weekRounded = round(week);
  const monthRounded = round(month);
  return {
    sessionsCompleted: sessions.length,
    streakDays: streakDays(
      sessions.map((s) => s.completedAt),
      now,
    ),
    minutesThisWeek: Math.round(week.reduce((sum, b) => sum + b.minutes, 0)),
    minutesThisMonth: Math.round(month.reduce((sum, b) => sum + b.minutes, 0)),
    week: weekRounded,
    month: monthRounded,
  };
}
