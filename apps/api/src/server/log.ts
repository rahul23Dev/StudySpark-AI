/**
 * Structured logging that never records user content or secrets: only event names,
 * sizes, counts, timings and error codes.
 */
export type LogFields = Record<string, string | number | boolean | null | undefined>;

export type Logger = (event: string, fields: LogFields) => void;

export const consoleLogger: Logger = (event, fields) => {
  console.info(JSON.stringify({ at: new Date().toISOString(), event, ...fields }));
};

export const silentLogger: Logger = () => {};
