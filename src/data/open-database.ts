import { randomUUID } from 'expo-crypto';
import { openDatabaseAsync } from 'expo-sqlite';
import { Platform } from 'react-native';

import { migrateAsync } from './migrations';
import { createStudyRepository, type StudyRepository } from './repository';

export const DATABASE_NAME = 'studyspark.db';

/** Opens the on-device database, enables foreign keys, migrates, and returns the repository. */
export async function openStudyRepository(): Promise<StudyRepository> {
  const db = await openDatabaseAsync(DATABASE_NAME);
  // Foreign keys are off by default in SQLite and are set per connection.
  await db.execAsync('PRAGMA foreign_keys = ON;');
  if (Platform.OS !== 'web') await db.execAsync('PRAGMA journal_mode = WAL;');
  await migrateAsync(db);
  return createStudyRepository(db, { uuid: randomUUID, now: () => new Date().toISOString() });
}
