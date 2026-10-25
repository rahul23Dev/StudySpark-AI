import { computeStudyStats, MAX_MINUTES_PER_SESSION, sessionMinutes, startOfWeek, streakDays } from '@/study/stats';

// Local-time helpers so the tests mean the same thing in any time zone.
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);
const iso = (date: Date) => date.toISOString();
const session = (start: Date, minutes: number) => ({
  startedAt: iso(start),
  completedAt: iso(new Date(start.getTime() + minutes * 60000)),
});

// Thursday 22 October 2026, local noon (the week starts Monday 19 October).
const NOW = at(2026, 10, 22);

describe('sessionMinutes', () => {
  it('measures and caps session length', () => {
    expect(sessionMinutes(session(NOW, 12.5))).toBeCloseTo(12.5);
    expect(sessionMinutes(session(NOW, 600))).toBe(MAX_MINUTES_PER_SESSION);
    expect(sessionMinutes({ startedAt: iso(NOW), completedAt: iso(at(2026, 10, 21)) })).toBe(0);
  });
});

describe('weeks and streaks', () => {
  it('starts weeks on Monday', () => {
    expect(startOfWeek(NOW)).toEqual(at(2026, 10, 19, 0));
    expect(startOfWeek(at(2026, 10, 26))).toEqual(at(2026, 10, 26, 0)); // a Monday
    expect(startOfWeek(at(2026, 10, 25))).toEqual(at(2026, 10, 19, 0)); // a Sunday
  });

  it('counts consecutive days ending today or yesterday', () => {
    expect(streakDays([], NOW)).toBe(0);
    expect(streakDays([iso(at(2026, 10, 22)), iso(at(2026, 10, 21)), iso(at(2026, 10, 20))], NOW)).toBe(3);
    expect(streakDays([iso(at(2026, 10, 21)), iso(at(2026, 10, 20))], NOW)).toBe(2); // nothing yet today
    expect(streakDays([iso(at(2026, 10, 22)), iso(at(2026, 10, 20))], NOW)).toBe(1); // gap yesterday
    expect(streakDays([iso(at(2026, 10, 19))], NOW)).toBe(0);
  });
});

describe('computeStudyStats', () => {
  it('is all zeros with no completed sessions', () => {
    const stats = computeStudyStats([], NOW);
    expect(stats).toMatchObject({ sessionsCompleted: 0, streakDays: 0, minutesThisWeek: 0, minutesThisMonth: 0 });
    expect(stats.week.map((d) => d.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(stats.week.every((d) => d.minutes === 0)).toBe(true);
  });

  it('buckets minutes by day this week and by week this month', () => {
    const stats = computeStudyStats(
      [
        session(at(2026, 10, 19, 9), 10), // Mon
        session(at(2026, 10, 21, 8), 15), // Wed
        session(at(2026, 10, 21, 10), 5), // Wed
        session(at(2026, 10, 14, 9), 20), // last week (Wed)
        session(at(2026, 9, 1, 9), 30), // too old for the month view
      ],
      NOW,
    );
    expect(stats.week.map((d) => d.minutes)).toEqual([10, 0, 20, 0, 0, 0, 0]);
    expect(stats.minutesThisWeek).toBe(30);
    expect(stats.month.map((w) => w.minutes)).toEqual([0, 0, 20, 30]);
    expect(stats.minutesThisMonth).toBe(50);
    expect(stats.sessionsCompleted).toBe(5);
    expect(stats.streakDays).toBe(1);
  });
});
