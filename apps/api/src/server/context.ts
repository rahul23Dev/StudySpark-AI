/** Per-process server state: config, provider, limits and usage meter. */
import { createProvider, type AiProvider } from '@/ai/provider';
import { loadConfig, type ApiConfig } from '@/config';
import { ConcurrencyLimiter, SlidingWindowRateLimiter, UsageMeter, type Clock } from '@/usage/limits';

import { consoleLogger, type Logger } from './log';

export type ServerContext = {
  config: ApiConfig;
  provider: AiProvider | null;
  rateLimiter: SlidingWindowRateLimiter;
  concurrency: ConcurrencyLimiter;
  meter: UsageMeter;
  log: Logger;
};

export function createContext(
  config: ApiConfig = loadConfig(),
  overrides: Partial<Omit<ServerContext, 'config'>> & { clock?: Clock } = {},
): ServerContext {
  const { clock, ...rest } = overrides;
  return {
    config,
    provider: 'provider' in rest ? (rest.provider ?? null) : createProvider(config),
    rateLimiter:
      rest.rateLimiter ?? new SlidingWindowRateLimiter(config.rateLimit.maxRequests, config.rateLimit.windowMs, clock),
    concurrency: rest.concurrency ?? new ConcurrencyLimiter(config.maxConcurrent),
    meter: rest.meter ?? new UsageMeter(config.dailyTokenBudget, clock),
    log: rest.log ?? consoleLogger,
  };
}

let shared: ServerContext | null = null;

/** The process-wide context used by the route handlers. */
export function getContext(): ServerContext {
  shared ??= createContext();
  return shared;
}
