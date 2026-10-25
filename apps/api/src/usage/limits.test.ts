import { describe, expect, it } from 'vitest';

import { loadConfig } from '@/config';

import { ConcurrencyLimiter, SlidingWindowRateLimiter, UsageMeter, estimateCostUsd } from './limits';

describe('SlidingWindowRateLimiter', () => {
  it('allows up to the limit per window, per client', () => {
    let now = 0;
    const limiter = new SlidingWindowRateLimiter(2, 60_000, () => now);
    expect(limiter.take('a').allowed).toBe(true);
    expect(limiter.take('a').allowed).toBe(true);
    expect(limiter.take('a')).toEqual({ allowed: false, retryAfterSeconds: 60 });
    expect(limiter.take('b').allowed).toBe(true);
    now = 30_000;
    expect(limiter.take('a')).toEqual({ allowed: false, retryAfterSeconds: 30 });
    now = 60_001;
    expect(limiter.take('a').allowed).toBe(true);
  });
});

describe('ConcurrencyLimiter', () => {
  it('caps in-flight work and releases once', () => {
    const limiter = new ConcurrencyLimiter(1);
    const release = limiter.tryAcquire();
    expect(release).not.toBeNull();
    expect(limiter.tryAcquire()).toBeNull();
    release!();
    release!(); // double release is harmless
    expect(limiter.inFlight).toBe(0);
    expect(limiter.tryAcquire()).not.toBeNull();
  });
});

describe('UsageMeter', () => {
  it('counts requests, tokens and cost, and enforces the daily budget', () => {
    let now = Date.UTC(2026, 9, 26, 10);
    const meter = new UsageMeter(1_000, () => now);
    expect(meter.hasBudget()).toBe(true);
    meter.record('claude-opus-5-5', 'succeeded', { inputTokens: 600, outputTokens: 300 });
    meter.record('claude-opus-5-5', 'failed', null);
    expect(meter.snapshot()).toMatchObject({
      day: '2026-10-26',
      requests: 2,
      succeeded: 1,
      failed: 1,
      inputTokens: 600,
      outputTokens: 300,
      remainingTokens: 100,
      estimatedCostUsd: 0.0084, // 600 x $4/M + 300 x $20/M
    });
    meter.record('claude-opus-5-5', 'succeeded', { inputTokens: 100, outputTokens: 50 });
    expect(meter.hasBudget()).toBe(false);
    now = Date.UTC(2026, 9, 27, 0, 0, 1); // new UTC day resets
    expect(meter.hasBudget()).toBe(true);
    expect(meter.snapshot().requests).toBe(0);
  });

  it('estimates zero for unpriced models', () => {
    expect(estimateCostUsd('some-other-model', { inputTokens: 1e6, outputTokens: 1e6 })).toBe(0);
  });
});

describe('loadConfig', () => {
  it('uses safe defaults and clamps out-of-range values', () => {
    const config = loadConfig({ AI_TIMEOUT_MS: '1', AI_MAX_SDK_RETRIES: '99', AI_EFFORT: 'max', ALLOWED_ORIGINS: 'http://a, http://b' });
    expect(config).toMatchObject({
      anthropicApiKey: null,
      model: 'claude-opus-5-5',
      effort: 'medium',
      timeoutMs: 5000,
      maxSdkRetries: 3,
      allowedOrigins: ['http://a', 'http://b'],
    });
  });
});
