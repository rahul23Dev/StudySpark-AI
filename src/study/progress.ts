/**
 * Progress statistics, computed only from saved answers (study_attempts) and the
 * completed-session count. Pure: `now` and the time zone are passed in.
 *
 * Definitions (also in docs/PROGRESS.md):
 * - Day: a local calendar date (YYYY-MM-DD) in the device's time zone, or `timeZone`.
 * - Cards reviewed: flashcard answers ("Know it" or "Review again").
 * - Daily goal: cards reviewed today >= the goal.
 * - Streak: consecutive days with at least one answer (card or quiz), ending today, or
 *   yesterday when nothing has been studied yet today.
 * - Quiz accuracy: correct quiz answers / all quiz answers, over all time. Unanswered
 *   questions are not counted. null when there are no quiz answers.
 * - Weekly activity: answers per day, Monday to Sunday of the current local week.
 * - Weak topics: decks with at least 3 answers in the last 30 days and at least one
 *   wrong ("Review again" or an incorrect quiz answer), worst miss rate first, top 3.
 */
export type ActivityAttempt = {
  answeredAt: string;
  mode: 'flashcards' | 'quiz';
  isCorrect: boolean;
  deckId: string;
  deckTitle: string;
  deckSubject: string;
};

/** A local calendar date, "YYYY-MM-DD". */
export type DayKey = string;

export const DEFAULT_DAILY_GOAL = 20;
export const DAILY_GOAL_OPTIONS = [10, 20, 30, 50] as const;
export const WEAK_TOPIC_WINDOW_DAYS = 30;
export const WEAK_TOPIC_MIN_ANSWERS = 3;
export const WEAK_TOPIC_LIMIT = 3;
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const pad = (n: number) => String(n).padStart(2, '0');
const formatters = new Map<string, Intl.DateTimeFormat>();

/** The local calendar date of `date` in `timeZone` (IANA name), or in the device's zone. */
export function dayKeyOf(date: Date, timeZone?: string): DayKey {
  if (!timeZone) return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  let fmt = formatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    formatters.set(timeZone, fmt);
  }
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Calendar arithmetic on the date itself, so DST and time zones can't skip or repeat a day. */
export function addDays(key: DayKey, days: number): DayKey {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(key: DayKey): number {
  const [y, m, d] = key.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** Consecutive study days ending today (or yesterday if today has no answers yet). */
export function streakFromDays(days: ReadonlySet<DayKey>, today: DayKey): number {
  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export type WeakTopic = {
  deckId: string;
  title: string;
  subject: string;
  answers: number;
  incorrect: number;
  /** Whole-number percent of answers that were wrong. */
  missRate: number;
};

export type ProgressSummary = {
  today: DayKey;
  hasActivity: boolean;
  goal: { target: number; cardsReviewedToday: number; met: boolean; percent: number };
  quizAnswersToday: number;
  streakDays: number;
  totals: { cardsReviewed: number; quizAnswers: number; sessionsCompleted: number };
  quizAccuracy: { percent: number | null; correct: number; answered: number };
  week: { day: DayKey; label: string; cards: number; quiz: number }[];
  weakTopics: WeakTopic[];
};

export function computeProgress(input: {
  attempts: readonly ActivityAttempt[];
  sessionsCompleted: number;
  dailyGoal: number;
  now: Date;
  timeZone?: string;
}): ProgressSummary {
  const { attempts, now, timeZone } = input;
  const target = Math.max(1, Math.round(input.dailyGoal));
  const today = dayKeyOf(now, timeZone);
  const weekStart = addDays(today, -weekdayIndex(today));
  const weakSince = addDays(today, -(WEAK_TOPIC_WINDOW_DAYS - 1));

  const week = WEEKDAY_LABELS.map((label, i) => ({ day: addDays(weekStart, i), label, cards: 0, quiz: 0 }));
  const studyDays = new Set<DayKey>();
  const topics = new Map<string, WeakTopic>();
  let cardsReviewed = 0;
  let quizAnswers = 0;
  let quizCorrect = 0;
  let cardsToday = 0;
  let quizToday = 0;

  for (const a of attempts) {
    const t = new Date(a.answeredAt);
    if (Number.isNaN(t.getTime()) || t.getTime() > now.getTime()) continue; // ignore bad or future timestamps
    const day = dayKeyOf(t, timeZone);
    studyDays.add(day);
    const isCard = a.mode === 'flashcards';
    if (isCard) cardsReviewed += 1;
    else {
      quizAnswers += 1;
      if (a.isCorrect) quizCorrect += 1;
    }
    if (day === today) {
      if (isCard) cardsToday += 1;
      else quizToday += 1;
    }
    const slot = week.find((w) => w.day === day);
    if (slot) {
      if (isCard) slot.cards += 1;
      else slot.quiz += 1;
    }
    if (day >= weakSince) {
      const topic = topics.get(a.deckId) ?? {
        deckId: a.deckId,
        title: a.deckTitle,
        subject: a.deckSubject,
        answers: 0,
        incorrect: 0,
        missRate: 0,
      };
      topic.answers += 1;
      if (!a.isCorrect) topic.incorrect += 1;
      topics.set(a.deckId, topic);
    }
  }

  const weakTopics = [...topics.values()]
    .filter((t) => t.answers >= WEAK_TOPIC_MIN_ANSWERS && t.incorrect > 0)
    .map((t) => ({ ...t, missRate: Math.round((t.incorrect / t.answers) * 100) }))
    .sort((a, b) => b.incorrect / b.answers - a.incorrect / a.answers || b.incorrect - a.incorrect || a.title.localeCompare(b.title))
    .slice(0, WEAK_TOPIC_LIMIT);

  return {
    today,
    hasActivity: studyDays.size > 0,
    goal: {
      target,
      cardsReviewedToday: cardsToday,
      met: cardsToday >= target,
      percent: Math.min(100, Math.round((cardsToday / target) * 100)),
    },
    quizAnswersToday: quizToday,
    streakDays: streakFromDays(studyDays, today),
    totals: { cardsReviewed, quizAnswers, sessionsCompleted: input.sessionsCompleted },
    quizAccuracy: {
      percent: quizAnswers === 0 ? null : Math.round((quizCorrect / quizAnswers) * 100),
      correct: quizCorrect,
      answered: quizAnswers,
    },
    week,
    weakTopics,
  };
}
