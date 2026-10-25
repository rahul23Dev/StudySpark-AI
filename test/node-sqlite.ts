// A real in-memory SQLite (Node's built-in node:sqlite) behind the app's SqlDatabase
// interface, so repository and migration tests exercise actual SQL, constraints and
// foreign keys instead of mocks.
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import type { SqlDatabase, SqlValue } from '@/data/database';
import { migrateAsync } from '@/data/migrations';
import { createStudyRepository } from '@/data/repository';

export type TestDatabase = SqlDatabase & { raw: DatabaseSync; close: () => void };

/** In-memory by default; pass a file path to test data surviving a close and reopen. */
export function openTestDatabase(path = ':memory:'): TestDatabase {
  const raw = new DatabaseSync(path);
  raw.exec('PRAGMA foreign_keys = ON');
  const plain = <T>(row: unknown) => (row ? ({ ...(row as object) } as T) : null);
  return {
    raw,
    close: () => raw.close(),
    async execAsync(sql) {
      raw.exec(sql);
    },
    async runAsync(sql, params: SqlValue[]) {
      const result = raw.prepare(sql).run(...params);
      return { changes: Number(result.changes) };
    },
    async getFirstAsync<T>(sql: string, params: SqlValue[]) {
      return plain<T>(raw.prepare(sql).get(...params));
    },
    async getAllAsync<T>(sql: string, params: SqlValue[]) {
      return raw.prepare(sql).all(...params).map((row) => plain<T>(row) as T);
    },
    async withTransactionAsync(task) {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

/** Migrated database + repository with a controllable clock. */
export async function openTestRepository(path?: string) {
  const db = openTestDatabase(path);
  await migrateAsync(db);
  let tick = 0;
  const clock = { now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)).toISOString() };
  const repo = createStudyRepository(db, { uuid: randomUUID, now: clock.now });
  return { db, repo };
}
