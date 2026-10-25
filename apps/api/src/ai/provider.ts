/**
 * Provider adapter. The rest of the server depends only on `AiProvider`, so the model
 * or vendor can change without touching routes, prompts or validation.
 *
 * The Anthropic implementation uses the official SDK (@anthropic-ai/sdk) with
 * structured outputs: the Zod schema is sent as the response format and the SDK
 * parses the reply against it. SDK-level retries cover 429/5xx/network errors with
 * backoff; each attempt has a timeout. Keys come from server env only.
 */
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';

import type { ApiConfig, Effort } from '@/config';
import {
  ApiError,
  ProviderConfigError,
  ProviderRateLimitError,
  ProviderTimeoutError,
  ProviderUnavailableError,
  RefusalError,
} from '@/errors';

export type TokenUsage = { inputTokens: number; outputTokens: number };

export type StructuredRequest<T> = {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  signal?: AbortSignal;
};

export type StructuredResult<T> = { data: T; usage: TokenUsage; model: string };

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  /** Returns schema-shaped data, or throws an ApiError / UnusableOutputError. */
  generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>>;
}

/** The model replied, but the reply can't be used (cut off, or not the required JSON). */
export class UnusableOutputError extends Error {
  constructor(
    readonly reason: string,
    readonly usage: TokenUsage,
  ) {
    super(reason);
    this.name = 'UnusableOutputError';
  }
}

/** Tokens spent by a call that then failed; attached so usage metering stays accurate. */
export function usageOf(error: unknown): TokenUsage | null {
  if (error instanceof UnusableOutputError) return error.usage;
  if (error && typeof error === 'object' && 'usage' in error) return (error as { usage: TokenUsage }).usage;
  return null;
}

/** The SDK surface this adapter uses (narrow, so tests can supply a fake). */
export type AnthropicLike = { beta: { messages: Pick<Anthropic['beta']['messages'], 'parse'> } };

export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';

  constructor(
    private readonly client: AnthropicLike,
    readonly model: string,
    private readonly options: { effort: Effort; maxOutputTokens: number },
  ) {}

  async generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    let response;
    try {
      response = await this.client.beta.messages.parse(
        {
          model: this.model,
          max_tokens: this.options.maxOutputTokens,
          system: req.system,
          messages: [{ role: 'user', content: req.prompt }],
          output_config: { effort: this.options.effort, format: zodOutputFormat(req.schema) },
          // If a safety classifier declines, re-run on Anthropic's recommended fallback model.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
        },
        { signal: req.signal },
      );
    } catch (error) {
      throw mapProviderError(error, this.model);
    }

    const usage: TokenUsage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
    if (response.stop_reason === 'refusal') {
      throw Object.assign(new RefusalError(), { usage });
    }
    if (response.stop_reason === 'max_tokens') {
      throw new UnusableOutputError('The answer was cut off before it finished.', usage);
    }
    if (response.parsed_output == null) {
      throw new UnusableOutputError('The answer was not valid JSON in the required format.', usage);
    }
    return { data: response.parsed_output as T, usage, model: response.model };
  }
}

/** Maps SDK errors (most specific first) to safe API errors. */
export function mapProviderError(error: unknown, model: string): Error {
  if (error instanceof ApiError || error instanceof UnusableOutputError) return error;
  if (error instanceof Anthropic.APIUserAbortError) return new ProviderTimeoutError();
  if (error instanceof Anthropic.APIConnectionTimeoutError) return new ProviderTimeoutError();
  if (error instanceof Anthropic.APIConnectionError) return new ProviderUnavailableError();
  if (error instanceof Anthropic.AuthenticationError) {
    return new ProviderConfigError("The AI provider rejected the server's API key. Check ANTHROPIC_API_KEY.");
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return new ProviderConfigError(`The API key is not allowed to use model "${model}".`);
  }
  if (error instanceof Anthropic.NotFoundError) {
    return new ProviderConfigError(`Model "${model}" is not available to this API key. Check AI_MODEL.`);
  }
  if (error instanceof Anthropic.RateLimitError) {
    const retryAfter = Number(error.headers?.get?.('retry-after'));
    return new ProviderRateLimitError(Number.isFinite(retryAfter) ? retryAfter : undefined);
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new ApiError(502, 'ai_request_rejected', 'The AI service rejected the request. Please try different input.', false);
  }
  if (error instanceof Anthropic.APIError) {
    if (error.status === 402) {
      return new ProviderConfigError('The AI provider account has a billing problem. Check the Anthropic Console.');
    }
    if (error.status === 413) {
      return new ApiError(413, 'input_too_large', 'The notes are too long for the AI. Please shorten them.', false);
    }
    return new ProviderUnavailableError();
  }
  return error instanceof Error ? error : new Error(String(error));
}

/** Builds the configured provider, or null when no key is set. */
export function createProvider(config: ApiConfig): AiProvider | null {
  if (!config.anthropicApiKey) return null;
  const client = new Anthropic({
    apiKey: config.anthropicApiKey,
    timeout: config.timeoutMs, // milliseconds, per attempt
    maxRetries: config.maxSdkRetries,
  });
  return new AnthropicProvider(client, config.model, {
    effort: config.effort,
    maxOutputTokens: config.maxOutputTokens,
  });
}
