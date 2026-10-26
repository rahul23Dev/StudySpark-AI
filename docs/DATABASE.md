# Local database

StudySpark AI stores decks, flashcards and quiz questions in an on-device SQLite database (`studyspark.db`) through `expo-sqlite`. On web, `expo-sqlite` uses a WebAssembly SQLite in the browser's private file storage. Metro is configured for it in `metro.config.js`: the `.wasm` asset and cross-origin-isolation headers.

## Layers

| File | Role |
| --- | --- |
| `src/data/database.ts` | `SqlDatabase`, the small interface the data layer needs; `expo-sqlite` satisfies it |
| `src/data/migrations.ts` | Versioned schema migrations and `migrateAsync` |
| `src/data/validation.ts` | Input validation and field limits |
| `src/data/repository.ts` | Typed functions for decks, flashcards and quiz questions; queues transactions so overlapping writes can't collide |
| `src/data/sessions.ts` | Study sessions: start, resume, record attempts, shuffle, complete, abandon |
| `src/study/scoring.ts` | Pure grading and scoring (`computeScore`), seeded shuffling |
| `src/study/session-state.ts` | Pure player state (navigation, reveal, double-submit guard) |
| `src/study/stats.ts` | Pure Progress statistics from completed sessions |
| `src/data/open-database.ts` | Opens the database, enables foreign keys (and WAL on devices), migrates |
| `src/data/database-context.tsx` | `DatabaseProvider` and `useRepository()`; the root layout shows loading and error/retry states |
| `src/data/use-query.ts` | Loads data when a screen gains focus, keeping old data while it refreshes |

On web the app also asks the browser to keep its storage (`navigator.storage.persist()`), so the database isn't evicted under storage pressure.

## Schema (version 1)

- **decks:**
  - `id` UUID, `title` (1–80 chars), `description` (≤500), `subject` (≤60).
  - `source` (`manual` | `duplicate` | `import` | `ai`) and `position` (the "My order" sort).
  - `created_at` and `updated_at` as ISO-8601 UTC.
  - Indexed on `position` and `updated_at`.
- **flashcards:**
  - `id` UUID, `deck_id` → decks (**ON DELETE CASCADE**), `front` (1–1000), `back` (1–2000).
  - `difficulty` (`easy` | `medium` | `hard`) and `position` (0-based, kept contiguous).
  - Timestamps; indexed on `(deck_id, position)`.
- **quiz_questions:**
  - `id` UUID, `deck_id` → decks (cascade), `type` (`multiple_choice` | `true_false`), `question` (1–500).
  - `correct_answer_index`, `explanation` (≤1000), `position` and timestamps.
- **quiz_question_options:**
  - `(question_id, position)` primary key, `question_id` → quiz_questions (cascade), `text` (1–300).
  - Options are **rows, not a JSON string**, so each one is typed and checked by the database.

## Schema (version 2): study sessions

- **study_sessions:**
  - `id` UUID, `deck_id` → decks (cascade), `mode` (`flashcards` | `quiz`), `status` (`active` | `completed` | `abandoned`).
  - `started_at`, `updated_at`, `completed_at`, `abandoned_at`, and `score_correct` / `score_total`, saved at completion.
  - CHECKs tie the status to its timestamp, and require a completed session to have a score with correct ≤ total.
  - A partial unique index allows **one active session per deck and mode**. Starting again abandons the old one.
- **study_session_items:** the cards or questions in a session, in study order.
  - `(session_id, position)` primary key, `UNIQUE (session_id, item_id)`.
- **study_attempts:**
  - `id` UUID, `session_id`, `item_id`, `submitted_answer` (`know` / `review` for flashcards, the option index for quizzes).
  - `is_correct` (0/1) and `answered_at`.
  - `UNIQUE (session_id, item_id)`: one answer per item per session.
  - A composite foreign key to `study_session_items`, so an attempt can only be for an item in its session.

### How sessions behave

- **Grading:** `recordAttempt` grades the answer itself, from the stored card or question. The UI's opinion is never trusted.
- **Retrying is safe:** answering an already-answered item returns the saved attempt with `duplicate: true` and changes nothing. A failed save can therefore be retried. A double tap, or two saves racing, store exactly one row: the second hits the unique constraint and returns the first.
- **Scores:** always computed from the saved attempts: correct ÷ items in the session, with unanswered items counted as not correct. `completeSession` stores that score, and tests check that it matches a fresh computation. Completing twice is a no-op.
- **Shuffling:** reorders only the unanswered items. Answered ones keep their place and their answers.
- **Deletions:** a card deleted mid-session shows as "deleted" and can be skipped. Deleting a deck removes its sessions and attempts (cascade).
- **Progress tab:** built from the saved answers and completed sessions. See [PROGRESS.md](PROGRESS.md) for every definition.

## Schema (version 3): spaced-repetition schedule

- **card_reviews:** one row per flashcard that has been reviewed. A card without a row is new and due now.
  - `card_id` primary key → flashcards (cascade), `deck_id` → decks (cascade).
  - `repetitions` (correct answers in a row), `lapses`, `interval_minutes`.
  - `due_at`, `last_reviewed_at` (UTC ISO instants), `last_result` (`know` | `review`), `updated_at`.
- **Indexes:** `card_reviews (deck_id, due_at)` and `(due_at)` for the due lists; `study_attempts (answered_at)` for the dashboard.
- **Written only by `recordAttempt`,** inside the transaction that saves the flashcard answer. If the answer isn't saved, the schedule doesn't change, and a duplicate (retried) answer doesn't move it again.
- **Resets** delete rows. Answers in `study_attempts` are never touched, so history and statistics survive a reset.
- **Upgrading from version 1 or 2:** after migrating, the app rebuilds every schedule once from the saved flashcard answers (`rebuildSchedules`), so existing study history isn't lost.

Every rule is enforced twice: once in TypeScript (`validation.ts`, which returns friendly per-field messages) and again as SQL `CHECK` / `NOT NULL` / foreign-key constraints. Bad data is rejected even if some future code skips validation. Quiz questions also need 2–6 distinct options (exactly 2 for true/false), and a correct-answer index inside the options.

Writes that touch several rows run in a transaction: create, duplicate, reorder, move and delete-with-reindex. Changing a deck's cards or questions also updates the deck's `updated_at`.

## Migrations

- The current version is stored in `PRAGMA user_version`.
- `migrateAsync` runs on every launch. It applies only the migrations newer than the database, each in its own transaction together with its version bump, so a failed migration leaves the database exactly as it was.
- It refuses to open a database written by a newer version of the app.
- **To change the schema:** append a new migration with the next version number. Never edit a shipped one.

## Tests

`src/__tests__/migrations.test.ts` and `repository.test.ts` run the real SQL against an in-memory SQLite: Node's built-in `node:sqlite`, wrapped by `test/node-sqlite.ts`. Foreign keys, cascades, CHECK constraints and transactions are all exercised for real. The screen tests in `decks-screens.test.tsx` drive the UI on top of the same in-memory database.
