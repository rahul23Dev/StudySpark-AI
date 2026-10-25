/** @jest-environment node */
import { getSchemaVersion, LATEST_SCHEMA_VERSION, migrateAsync, MIGRATIONS, type Migration } from '@/data/migrations';

import { openTestDatabase } from '../../test/node-sqlite';

const tables = (db: ReturnType<typeof openTestDatabase>) =>
  db.raw
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((r) => (r as { name: string }).name);

describe('migrations', () => {
  it('creates the schema on a fresh database', async () => {
    const db = openTestDatabase();
    expect(await getSchemaVersion(db)).toBe(0);
    expect(await migrateAsync(db)).toEqual({ from: 0, to: LATEST_SCHEMA_VERSION });
    expect(await getSchemaVersion(db)).toBe(LATEST_SCHEMA_VERSION);
    expect(tables(db)).toEqual([
      'decks',
      'flashcards',
      'quiz_question_options',
      'quiz_questions',
      'study_attempts',
      'study_session_items',
      'study_sessions',
    ]);
  });

  it('is repeatable: running again changes nothing and keeps data', async () => {
    const db = openTestDatabase();
    await migrateAsync(db);
    db.raw
      .prepare("INSERT INTO decks (id, title, position, created_at, updated_at) VALUES ('d1', 'Kept', 0, 'x', 'x')")
      .run();
    expect(await migrateAsync(db)).toEqual({ from: LATEST_SCHEMA_VERSION, to: LATEST_SCHEMA_VERSION });
    expect(db.raw.prepare('SELECT title FROM decks').all()).toEqual([expect.objectContaining({ title: 'Kept' })]);
  });

  it('creates the indexes used for ordering and lookups', async () => {
    const db = openTestDatabase();
    await migrateAsync(db);
    const indexes = db.raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%' ORDER BY name")
      .all()
      .map((r) => (r as { name: string }).name);
    expect(indexes).toEqual([
      'idx_decks_position',
      'idx_decks_updated_at',
      'idx_flashcards_deck_position',
      'idx_quiz_questions_deck_position',
      'idx_study_attempts_session',
      'idx_study_sessions_completed_at',
      'idx_study_sessions_deck',
      'idx_study_sessions_one_active',
    ]);
  });

  it('applies only newer migrations, in order', async () => {
    const db = openTestDatabase();
    await migrateAsync(db);
    const next: Migration[] = [
      ...MIGRATIONS,
      { version: MIGRATIONS.length + 1, name: 'test column', sql: "ALTER TABLE decks ADD COLUMN color TEXT NOT NULL DEFAULT ''" },
    ];
    expect(await migrateAsync(db, next)).toEqual({ from: MIGRATIONS.length, to: MIGRATIONS.length + 1 });
    const columns = db.raw.prepare('PRAGMA table_info(decks)').all().map((c) => (c as { name: string }).name);
    expect(columns).toContain('color');
  });

  it('rolls back a failing migration, leaving the version unchanged', async () => {
    const db = openTestDatabase();
    await migrateAsync(db);
    const broken: Migration[] = [
      ...MIGRATIONS,
      { version: MIGRATIONS.length + 1, name: 'broken', sql: 'CREATE TABLE half_done (id TEXT); SELECT * FROM missing_table;' },
    ];
    await expect(migrateAsync(db, broken)).rejects.toThrow();
    expect(await getSchemaVersion(db)).toBe(MIGRATIONS.length);
    expect(tables(db)).not.toContain('half_done');
  });

  it('refuses a database newer than the app', async () => {
    const db = openTestDatabase();
    db.raw.exec(`PRAGMA user_version = ${LATEST_SCHEMA_VERSION + 1}`);
    await expect(migrateAsync(db)).rejects.toThrow(/newer than this app/);
  });

  it('upgrades a version-1 database to the latest without losing decks', async () => {
    const db = openTestDatabase();
    await migrateAsync(db, MIGRATIONS.slice(0, 1));
    db.raw
      .prepare("INSERT INTO decks (id, title, position, created_at, updated_at) VALUES ('d1', 'Old deck', 0, 'x', 'x')")
      .run();
    expect(await migrateAsync(db)).toEqual({ from: 1, to: LATEST_SCHEMA_VERSION });
    expect(tables(db)).toContain('study_sessions');
    expect(db.raw.prepare('SELECT title FROM decks').all()).toEqual([expect.objectContaining({ title: 'Old deck' })]);
  });

  it('allows only one active session per deck and mode', async () => {
    const db = openTestDatabase();
    await migrateAsync(db);
    db.raw.exec("INSERT INTO decks (id, title, position, created_at, updated_at) VALUES ('d', 'Deck', 0, 'x', 'x')");
    const insert = (id: string, status = 'active') =>
      db.raw
        .prepare(
          "INSERT INTO study_sessions (id, deck_id, mode, status, started_at, updated_at, abandoned_at) VALUES (?, 'd', 'quiz', ?, 'x', 'x', ?)",
        )
        .run(id, status, status === 'abandoned' ? 'x' : null);
    insert('s1');
    expect(() => insert('s2')).toThrow(/UNIQUE/);
    insert('s3', 'abandoned');
  });

  it('rejects badly numbered migration lists', async () => {
    const db = openTestDatabase();
    await expect(migrateAsync(db, [{ version: 2, name: 'gap', sql: '' }])).rejects.toThrow(/numbered/);
  });
});
