export type SqlValue = string | number | null;

/**
 * The subset of expo-sqlite's SQLiteDatabase the data layer uses. Keeping it this
 * small lets tests run the same code against a real in-memory SQLite in Node.
 */
export interface SqlDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: SqlValue[]): Promise<{ changes: number }>;
  getFirstAsync<T>(sql: string, params: SqlValue[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params: SqlValue[]): Promise<T[]>;
  /** Runs `task` in a transaction; rolls back if it throws. */
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}
