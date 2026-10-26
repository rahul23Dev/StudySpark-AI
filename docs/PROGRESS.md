# Progress and spaced repetition

Every number on the Progress tab, the Home "Today" card and the deck screen's "Spaced review" panel is computed from data saved on the device. Nothing is estimated, sampled or hard-coded. With no saved answers, every count is 0, quiz accuracy shows "No quiz answers yet", and the streak is 0.

The rules live in two pure modules with no UI or database code:

- `src/study/scheduler.ts`: when a card is next due.
- `src/study/progress.ts`: the dashboard numbers.

`src/data/reviews.ts` only stores and queries their results.

## Spaced-repetition schedule

Each flashcard has at most one row in `card_reviews` (see [DATABASE.md](DATABASE.md)). A card with no row is **new**, and new cards are due immediately.

Every flashcard answer updates the card's schedule, in the same transaction that saves the answer:

| Answer | Effect |
| --- | --- |
| **Review again** | The run of correct answers drops to 0 and the lapse count goes up by 1. Due again in **10 minutes**. |
| **Know it** | The run goes up by 1. The next interval follows the table below. |

| Correct answers in a row | 1 | 2 | 3 | 4 | 5 | 6+ |
| --- | --- | --- | --- | --- | --- | --- |
| Next review after | 1 day | 3 days | 7 days | 16 days | 35 days | double the previous interval, up to 180 days |

- **Deterministic:** the same answers at the same times always give the same schedule. No randomness, and no reading of the clock inside the scheduler. `replayReviews` rebuilds a schedule from saved answers, and tests check that a rebuild equals the live result.
- **Intervals are exact durations** from the moment of the answer (stored as UTC instants), so time zones and daylight-saving changes don't move a due time.
- **Retried saves don't count twice.** A duplicate answer (the same card in the same session) is ignored, so the schedule moves once.
- **Manual reset:**
  - "Reset this card's schedule" (card edit screen) or "Reset schedule" (deck screen, after a confirmation) deletes the schedule rows.
  - The cards become new and due now.
  - Past answers stay, so the history and the Progress numbers are unchanged.
- **Reviewing due cards:** "Review due cards" (deck screen) or "Review" (Progress tab) starts a flashcard session containing only due and new cards: most overdue first, then new cards in deck order.
- **Upgrading:** a database created before scheduling existed (version 1 or 2) gets its schedules rebuilt once from its saved flashcard answers.

## Dashboard definitions

A **day** is a local calendar date (YYYY-MM-DD) in the device's current time zone. Answers are stored as UTC instants and assigned to days when the dashboard is computed. If you travel, past answers are regrouped into the new zone's days.

| Number | Definition |
| --- | --- |
| **Cards reviewed** | Flashcard answers saved, "Know it" and "Review again" alike. Today's count is the answers dated today. |
| **Daily goal** | Today's cards reviewed against the goal you chose in Settings: 10, 20 (the default), 30 or 50 cards. Met when today's count reaches the goal. Quiz answers are shown beside it but don't count towards it. |
| **Streak** | Consecutive days, each with at least one saved answer (card or quiz). It ends today, or yesterday if you haven't studied yet today, so the streak doesn't drop to 0 at midnight. |
| **Sessions completed** | Flashcard and quiz sessions you finished. Abandoned or in-progress sessions don't count. |
| **Quiz accuracy** | Correct quiz answers ÷ quiz answers, over all time, rounded to a whole percent. Questions left unanswered in a session are not counted. If there are no quiz answers, it shows "No quiz answers yet" instead of 0%. |
| **This week** | Answers per day from Monday to Sunday of the current week. Flashcards are teal and quiz answers coral, stacked. |
| **Due for review** | For each deck: cards whose next review time has passed, and new cards. Decks with neither are hidden. |
| **Topics to revisit** | Decks with at least 3 answers in the last 30 days (today plus the 29 days before) and at least one wrong answer. A wrong answer is "Review again" or an incorrect quiz answer. Sorted by miss rate (wrong ÷ answers), worst first; the top 3 are shown. |

Answers dated in the future (for example after the device clock was wrong) are ignored until that time arrives.

## Tests

- `scheduler.test.ts`: the interval sequence, lapses, the cap, determinism and replay.
- `progress.test.ts`: every definition above, including:
  - Days in Asia/Kolkata, America/New_York and Europe/London.
  - Answers either side of local midnight.
  - Daylight-saving changes.
  - Month, year and leap-day boundaries.
  - Travelling between time zones.
  - Future timestamps.
- `reviews.test.ts`:
  - Schedules change only with saved answers, and a failed save leaves them unchanged.
  - Due-only sessions, resets and rebuilds.
  - The dashboard numbers match direct SQL counts over the same database.
- `progress-screen.test.tsx`: the screens show exactly what was saved, including the empty state, and the review and reset buttons work.
