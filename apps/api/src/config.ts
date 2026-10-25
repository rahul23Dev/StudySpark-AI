/** Server configuration from environment variables, with safe bounds and defaults. */
export type Effort = 'low' | 'medium' | 'high';

export type ApiConfig = {
  /** null when not configured: AI endpoints then answer 503 ai_not_configured. */
  anthropicApiKey: string | null;
  model: string;
  effort: Effort;
  timeoutMs: number;
  maxSdkRetries: number;
  maxValidationAttempts: number;
  maxOutputTokens: number;
  rateLimit: { maxRequests: number; windowMs: number };
  maxConcurrent: number;
  dailyTokenBudget: number;
  maxBodyBytes: number;
  allowedOrigins: string[];
};

export const DEFAULT_MODEL = 'claude-opus-5-5';

function int(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

export function loadConfig(env: Record<string, string | undefined> = process.env): ApiConfig {
  const key = env.ANTHROPIC_API_KEY?.trim();
  const effort = env.AI_EFFORT?.trim();
  return {
    anthropicApiKey: key ? key : null,
    model: env.AI_MODEL?.trim() || DEFAULT_MODEL,
    effort: effort === 'low' || effort === 'high' ? effort : 'medium',
    timeoutMs: int(env.AI_TIMEOUT_MS, 60_000, 5_000, 300_000),
    maxSdkRetries: int(env.AI_MAX_SDK_RETRIES, 2, 0, 3),
    maxValidationAttempts: int(env.AI_MAX_VALIDATION_ATTEMPTS, 2, 1, 3),
    // Adaptive thinking counts toward max_tokens; 16k keeps non-streaming calls safe.
    maxOutputTokens: 16_000,
    rateLimit: {
      maxRequests: int(env.AI_RATE_LIMIT_MAX, 10, 1, 1000),
      windowMs: int(env.AI_RATE_LIMIT_WINDOW_MS, 60_000, 1_000, 3_600_000),
    },
    maxConcurrent: int(env.AI_MAX_CONCURRENT, 3, 1, 50),
    dailyTokenBudget: int(env.AI_DAILY_TOKEN_BUDGET, 500_000, 0, 1_000_000_000),
    maxBodyBytes: int(env.AI_MAX_BODY_BYTES, 65_536, 1_024, 1_048_576),
    allowedOrigins: (env.ALLOWED_ORIGINS ?? 'http://localhost:8081')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  };
}
