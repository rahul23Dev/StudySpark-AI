/**
 * Usage bounds and metering, kept in memory for a single server process:
 * - a per-client sliding-window rate limit,
 * - a global cap on concurrent generations,
 * - a daily (UTC) token budget across all clients,
 * - counters for requests, failures, tokens and an estimated cost.
 * Counters reset when the server restarts; a multi-instance deployment would move
 * these to a shared store.
 */
import type { TokenUsage } from '@/ai/provider';

/** USD per million tokens, from https://platform.claude.com/docs/en/about-claude/pricing (checked 2026-10-26). */
export const PRICES_PER_MILLION: Record<string, { input: number; output: number }> = {
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
};

export type Clock = () => number;

export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
    private readonly now: Clock = Date.now,
  ) {}

  /** Records a hit for `key` if allowed. */
  take(key: string): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((at) => t - at < this.windowMs);
    if (recent.length >= this.maxRequests) {
      this.hits.set(key, recent);
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + this.windowMs - t) / 1000)) };
    }
    recent.push(t);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.prune(t);
    return { allowed: true };
  }

  private prune(t: number) {
    for (const [key, list] of this.hits) {
      if (list.every((at) => t - at >= this.windowMs)) this.hits.delete(key);
    }
  }
}

export class ConcurrencyLimiter {
  private active = 0;
  constructor(private readonly max: number) {}

  tryAcquire(): (() => void) | null {
    if (this.active >= this.max) return null;
    this.active += 1;
    let released = false;
    return () => {
      if (!released) {
        released = true;
        this.active -= 1;
      }
    };
  }

  get inFlight() {
    return this.active;
  }
}

export type UsageSnapshot = {
  day: string;
  requests: number;
  succeeded: number;
  failed: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  dailyTokenBudget: number;
  remainingTokens: number;
};

export class UsageMeter {
  private day = '';
  private counts = { requests: 0, succeeded: 0, failed: 0, inputTokens: 0, outputTokens: 0, cost: 0 };

  constructor(
    private readonly dailyTokenBudget: number,
    private readonly now: Clock = Date.now,
  ) {}

  private roll() {
    const today = new Date(this.now()).toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.counts = { requests: 0, succeeded: 0, failed: 0, inputTokens: 0, outputTokens: 0, cost: 0 };
    }
  }

  /** True while today's budget still has room. */
  hasBudget(): boolean {
    this.roll();
    return this.counts.inputTokens + this.counts.outputTokens < this.dailyTokenBudget;
  }

  record(model: string, outcome: 'succeeded' | 'failed', usage: TokenUsage | null) {
    this.roll();
    this.counts.requests += 1;
    this.counts[outcome] += 1;
    if (usage) {
      this.counts.inputTokens += usage.inputTokens;
      this.counts.outputTokens += usage.outputTokens;
      this.counts.cost += estimateCostUsd(model, usage);
    }
  }

  snapshot(): UsageSnapshot {
    this.roll();
    const used = this.counts.inputTokens + this.counts.outputTokens;
    return {
      day: this.day,
      requests: this.counts.requests,
      succeeded: this.counts.succeeded,
      failed: this.counts.failed,
      inputTokens: this.counts.inputTokens,
      outputTokens: this.counts.outputTokens,
      estimatedCostUsd: Math.round(this.counts.cost * 10_000) / 10_000,
      dailyTokenBudget: this.dailyTokenBudget,
      remainingTokens: Math.max(0, this.dailyTokenBudget - used),
    };
  }
}

/** Estimated cost; 0 for models without a known price. Thinking tokens bill as output. */
export function estimateCostUsd(model: string, usage: TokenUsage): number {
  const price = PRICES_PER_MILLION[model];
  if (!price) return 0;
  return (usage.inputTokens * price.input + usage.outputTokens * price.output) / 1_000_000;
}
