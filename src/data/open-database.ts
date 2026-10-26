import { randomUUID } from 'expo-crypto';
import { openDatabaseAsync } from 'expo-sqlite';
import { Platform } from 'react-native';

import { migrateAsync } from './migrations';
import { createStudyRepository, type StudyRepository } from './repository';

export const DATABASE_NAME = 'studyspark.db';

/** Opens the on-device database, enables foreign keys, migrates, and returns the repository. */
export async function openStudyRepository(): Promise<StudyRepository> {
  if (Platform.OS === 'web') {
    // Ask the browser not to evict the database under storage pressure. Best effort:
    // browsers may decline, and older ones lack the API.
    globalThis.navigator?.storage?.persist?.().catch(() => undefined);
  }
  const db = await openDatabaseAsync(DATABASE_NAME);
  // Foreign keys are off by default in SQLite and are set per connection.
  await db.execAsync('PRAGMA foreign_keys = ON;');
  if (Platform.OS !== 'web') await db.execAsync('PRAGMA journal_mode = WAL;');
  const { from } = await migrateAsync(db);
  const repository = createStudyRepository(db, { uuid: randomUUID, now: () => new Date().toISOString() });
  // Schedules arrived in schema v3: build them once from answers saved before that.
  if (from > 0 && from < 3) await repository.rebuildSchedules();
  return repository;
}
