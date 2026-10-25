import type { SqlDatabase } from './database';

export type Migration = { version: number; name: string; sql: string };

/**
 * Ordered schema migrations. Never edit a shipped migration: add a new one with the
 * next version. The applied version is stored in SQLite's `PRAGMA user_version`.
 * CHECK limits mirror LIMITS in validation.ts.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'decks, flashcards and quiz questions',
    sql: `
      CREATE TABLE decks (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 80),
        description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 500),
        subject TEXT NOT NULL DEFAULT '' CHECK (length(subject) <= 60),
        source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'duplicate', 'import', 'ai')),
        position INTEGER NOT NULL CHECK (position >= 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_decks_position ON decks (position);
      CREATE INDEX idx_decks_updated_at ON decks (updated_at);

      CREATE TABLE flashcards (
        id TEXT PRIMARY KEY NOT NULL,
        deck_id TEXT NOT NULL REFERENCES decks (id) ON DELETE CASCADE,
        front TEXT NOT NULL CHECK (length(trim(front)) BETWEEN 1 AND 1000),
        back TEXT NOT NULL CHECK (length(trim(back)) BETWEEN 1 AND 2000),
        difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
        position INTEGER NOT NULL CHECK (position >= 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_flashcards_deck_position ON flashcards (deck_id, position);

      CREATE TABLE quiz_questions (
        id TEXT PRIMARY KEY NOT NULL,
        deck_id TEXT NOT NULL REFERENCES decks (id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('multiple_choice', 'true_false')),
        question TEXT NOT NULL CHECK (length(trim(question)) BETWEEN 1 AND 500),
        correct_answer_index INTEGER NOT NULL CHECK (correct_answer_index >= 0),
        explanation TEXT NOT NULL DEFAULT '' CHECK (length(explanation) <= 1000),
        position INTEGER NOT NULL CHECK (position >= 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_quiz_questions_deck_position ON quiz_questions (deck_id, position);

      -- Answer options as rows, not a JSON string, so every option is typed and checked.
      CREATE TABLE quiz_question_options (
        question_id TEXT NOT NULL REFERENCES quiz_questions (id) ON DELETE CASCADE,
        position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 5),
        text TEXT NOT NULL CHECK (length(trim(text)) BETWEEN 1 AND 300),
        PRIMARY KEY (question_id, position)
      );
    `,
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export async function getSchemaVersion(db: SqlDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  return Number(row?.user_version ?? 0);
}

/**
 * Applies every migration newer than the database, each in its own transaction
 * together with its version bump. Safe to call on every launch: an up-to-date
 * database is left untouched.
 */
export async function migrateAsync(
  db: SqlDatabase,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<{ from: number; to: number }> {
  migrations.forEach((m, i) => {
    if (m.version !== i + 1) throw new Error(`Migrations must be numbered 1, 2, 3…; found ${m.version} at ${i}`);
  });
  const latest = migrations.length;
  const from = await getSchemaVersion(db);
  if (from > latest) {
    throw new Error(`Database schema v${from} is newer than this app supports (v${latest}).`);
  }
  for (const migration of migrations.slice(from)) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(migration.sql);
      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }
  return { from, to: latest };
}
