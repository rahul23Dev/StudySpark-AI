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

/**
 * One connection can only hold one transaction at a time; starting a second while the
 * first is open fails ("cannot start a transaction within a transaction"). This wrapper
 * queues transactions so overlapping writes (e.g. a double-tapped answer) run one after
 * another. Transactions must not be nested inside each other.
 */
export function withSerializedTransactions(db: SqlDatabase): SqlDatabase {
  let queue: Promise<unknown> = Promise.resolve();
  return {
    execAsync: (sql) => db.execAsync(sql),
    runAsync: (sql, params) => db.runAsync(sql, params),
    getFirstAsync: (sql, params) => db.getFirstAsync(sql, params),
    getAllAsync: (sql, params) => db.getAllAsync(sql, params),
    withTransactionAsync(task) {
      const run = queue.then(() => db.withTransactionAsync(task));
      queue = run.catch(() => undefined);
      return run;
    },
  };
}
