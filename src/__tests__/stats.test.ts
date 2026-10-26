import { MAX_MINUTES_PER_SESSION, sessionMinutes } from '@/study/stats';

// Local-time helpers so the tests mean the same thing in any time zone.
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);
const iso = (date: Date) => date.toISOString();
const session = (start: Date, minutes: number) => ({
  startedAt: iso(start),
  completedAt: iso(new Date(start.getTime() + minutes * 60000)),
});

// Thursday 22 October 2026, local noon.
const NOW = at(2026, 10, 22);

describe('sessionMinutes', () => {
  it('measures and caps session length', () => {
    expect(sessionMinutes(session(NOW, 12.5))).toBeCloseTo(12.5);
    expect(sessionMinutes(session(NOW, 600))).toBe(MAX_MINUTES_PER_SESSION);
    expect(sessionMinutes({ startedAt: iso(NOW), completedAt: iso(at(2026, 10, 21)) })).toBe(0);
  });
});

