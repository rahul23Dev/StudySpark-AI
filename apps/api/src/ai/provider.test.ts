import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ProviderConfigError, ProviderRateLimitError, ProviderTimeoutError, ProviderUnavailableError, RefusalError } from '@/errors';
import { loadConfig } from '@/config';

import { AnthropicProvider, UnusableOutputError, createProvider, mapProviderError, usageOf, type AnthropicLike } from './provider';

const schema = z.object({ answer: z.string() });

function fakeClient(result: unknown) {
  const parse = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  return { client: { beta: { messages: { parse } } } as unknown as AnthropicLike, parse };
}

const reply = (overrides: Record<string, unknown> = {}) => ({
  model: 'claude-opus-5-5',
  stop_reason: 'end_turn',
  usage: { input_tokens: 120, output_tokens: 80 },
  parsed_output: { answer: 'ok' },
  content: [],
  ...overrides,
});

const make = (client: AnthropicLike) => new AnthropicProvider(client, 'claude-opus-5-5', { effort: 'medium', maxOutputTokens: 16000 });

describe('AnthropicProvider', () => {
  it('sends the structured-output request with fallbacks and returns parsed data and usage', async () => {
    const { client, parse } = fakeClient(reply());
    const out = await make(client).generateStructured({ system: 'SYS', prompt: 'PROMPT', schema });
    expect(out).toEqual({ data: { answer: 'ok' }, usage: { inputTokens: 120, outputTokens: 80 }, model: 'claude-opus-5-5' });
    const [params] = parse.mock.calls[0] as unknown as [Record<string, any>];
    expect(params).toMatchObject({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      system: 'SYS',
      messages: [{ role: 'user', content: 'PROMPT' }],
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
    });
    expect(params.output_config.format).toBeDefined();
    expect(params).not.toHaveProperty('thinking'); // thinking is always on for Opus 5.5
    expect(params).not.toHaveProperty('temperature');
  });

  it('treats a refusal as a refusal error that still carries usage', async () => {
    const { client } = fakeClient(reply({ stop_reason: 'refusal', parsed_output: null }));
    const error = await make(client).generateStructured({ system: 's', prompt: 'p', schema }).catch((e) => e);
    expect(error).toBeInstanceOf(RefusalError);
    expect(usageOf(error)).toEqual({ inputTokens: 120, outputTokens: 80 });
  });

  it('marks truncated and unparseable replies as unusable (retryable)', async () => {
    for (const r of [reply({ stop_reason: 'max_tokens' }), reply({ parsed_output: null })]) {
      const { client } = fakeClient(r);
      await expect(make(client).generateStructured({ system: 's', prompt: 'p', schema })).rejects.toBeInstanceOf(UnusableOutputError);
    }
  });
});

describe('mapProviderError', () => {
  const err = (status: number, headers?: Record<string, string>) =>
    Anthropic.APIError.generate(status, { type: 'error', error: { type: 'x', message: 'm' } }, 'm', new Headers(headers));

  it.each([
    [401, ProviderConfigError],
    [403, ProviderConfigError],
    [404, ProviderConfigError],
    [402, ProviderConfigError],
    [500, ProviderUnavailableError],
    [529, ProviderUnavailableError],
  ])('maps HTTP %i to %o', (status, type) => {
    expect(mapProviderError(err(status), 'claude-opus-5-5')).toBeInstanceOf(type);
  });

  it('maps rate limits with Retry-After', () => {
    const mapped = mapProviderError(err(429, { 'retry-after': '12' }), 'm');
    expect(mapped).toBeInstanceOf(ProviderRateLimitError);
    expect((mapped as ProviderRateLimitError).details).toEqual({ retryAfterSeconds: 12 });
  });

  it('maps timeouts, aborts and connection failures', () => {
    expect(mapProviderError(new Anthropic.APIConnectionTimeoutError(), 'm')).toBeInstanceOf(ProviderTimeoutError);
    expect(mapProviderError(new Anthropic.APIUserAbortError(), 'm')).toBeInstanceOf(ProviderTimeoutError);
    expect(mapProviderError(new Anthropic.APIConnectionError({ message: 'down' }), 'm')).toBeInstanceOf(ProviderUnavailableError);
  });

  it('never puts the API key in user-facing messages', () => {
    const mapped = mapProviderError(err(401), 'claude-opus-5-5');
    expect(mapped.message).not.toMatch(/sk-ant/);
  });
});

describe('createProvider', () => {
  it('returns null without a key (no client-side or fallback key)', () => {
    expect(createProvider(loadConfig({}))).toBeNull();
    expect(createProvider(loadConfig({ ANTHROPIC_API_KEY: '   ' }))).toBeNull();
  });

  it('builds the Anthropic provider with the configured model', () => {
    const provider = createProvider(loadConfig({ ANTHROPIC_API_KEY: 'test-key-not-real', AI_MODEL: 'claude-sonnet-5-5' }));
    expect(provider).toMatchObject({ name: 'anthropic', model: 'claude-sonnet-5-5' });
  });
});
