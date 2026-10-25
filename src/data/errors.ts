/** Input that breaks a data rule. `issues` maps field name to a user-facing message. */
export class ValidationError extends Error {
  constructor(readonly issues: Record<string, string>) {
    super(`Invalid input: ${Object.entries(issues).map(([field, msg]) => `${field} – ${msg}`).join('; ')}`);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(what: string, id: string) {
    super(`${what} not found: ${id}`);
    this.name = 'NotFoundError';
  }
}
