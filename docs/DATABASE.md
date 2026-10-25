# Local database

StudySpark AI stores decks, flashcards and quiz questions in an on-device SQLite database (`studyspark.db`) through `expo-sqlite`. On web, `expo-sqlite` uses a WebAssembly SQLite in the browser's private file storage. Metro is configured for it in `metro.config.js`: the `.wasm` asset and cross-origin-isolation headers.

## Layers

| File | Role |
| --- | --- |
| `src/data/database.ts` | `SqlDatabase`, the small interface the data layer needs; `expo-sqlite` satisfies it |
| `src/data/migrations.ts` | Versioned schema migrations and `migrateAsync` |
| `src/data/validation.ts` | Input validation and field limits |
| `src/data/repository.ts` | Typed functions for decks, flashcards and quiz questions |
| `src/data/open-database.ts` | Opens the database, enables foreign keys (and WAL on devices), migrates |
| `src/data/database-context.tsx` | `DatabaseProvider` and `useRepository()`; the root layout shows loading and error/retry states |
| `src/data/use-query.ts` | Loads data when a screen gains focus, keeping old data while it refreshes |

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

Every rule is enforced twice: once in TypeScript (`validation.ts`, which returns friendly per-field messages) and again as SQL `CHECK` / `NOT NULL` / foreign-key constraints. Bad data is rejected even if some future code skips validation. Quiz questions also need 2–6 distinct options (exactly 2 for true/false), and a correct-answer index inside the options.

Writes that touch several rows run in a transaction: create, duplicate, reorder, move and delete-with-reindex. Changing a deck's cards or questions also updates the deck's `updated_at`.

## Migrations

- The current version is stored in `PRAGMA user_version`.
- `migrateAsync` runs on every launch. It applies only the migrations newer than the database, each in its own transaction together with its version bump, so a failed migration leaves the database exactly as it was.
- It refuses to open a database written by a newer version of the app.
- **To change the schema:** append a new migration with the next version number. Never edit a shipped one.

## Tests

`src/__tests__/migrations.test.ts` and `repository.test.ts` run the real SQL against an in-memory SQLite: Node's built-in `node:sqlite`, wrapped by `test/node-sqlite.ts`. Foreign keys, cascades, CHECK constraints and transactions are all exercised for real. The screen tests in `decks-screens.test.tsx` drive the UI on top of the same in-memory database.
