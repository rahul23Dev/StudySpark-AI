/**
 * Errors the API turns into HTTP responses. `code` is stable and machine-readable
 * (the app switches on it); `message` is safe to show users and never contains
 * secrets or the user's notes.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable: boolean,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** The server has no provider credentials. */
export class NotConfiguredError extends ApiError {
  constructor() {
    super(
      503,
      'ai_not_configured',
      'AI generation is not set up on the server yet. Add ANTHROPIC_API_KEY to apps/api/.env.local and restart the API.',
      false,
    );
  }
}

/** Credentials or model settings were rejected by the provider. */
export class ProviderConfigError extends ApiError {
  constructor(message: string) {
    super(503, 'ai_misconfigured', message, false);
  }
}

export class ProviderRateLimitError extends ApiError {
  constructor(retryAfterSeconds?: number) {
    super(429, 'provider_rate_limited', 'The AI service is busy right now. Please try again shortly.', true, {
      retryAfterSeconds,
    });
  }
}

export class ProviderTimeoutError extends ApiError {
  constructor() {
    super(504, 'ai_timeout', 'The AI took too long to respond. Please try again.', true);
  }
}

export class ProviderUnavailableError extends ApiError {
  constructor() {
    super(503, 'ai_unavailable', 'The AI service is temporarily unavailable. Please try again.', true);
  }
}

/** The provider declined the request (safety refusal). */
export class RefusalError extends ApiError {
  constructor() {
    super(422, 'ai_refused', "The AI couldn't create study material from this input. Try a different topic or notes.", false);
  }
}

/** The model's output failed validation on every attempt. */
export class InvalidModelOutputError extends ApiError {
  constructor(readonly issues: string[]) {
    super(502, 'invalid_ai_output', "The AI's answer didn't pass our quality checks. Please try again.", true, {
      issues: issues.slice(0, 10),
    });
  }
}
