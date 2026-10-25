import { describe, expect, it } from 'vitest';

import type { AiProvider, StructuredRequest } from '@/ai/provider';
import { loadConfig } from '@/config';
import { ProviderTimeoutError } from '@/errors';

import { createContext } from './context';
import { handleGenerate, handleHealth, handleOptions } from './handlers';
import type { LogFields } from './log';

const goodDeck = {
  deckTitle: 'Cells',
  cards: [
    { question: 'What is a cell?', answer: 'Basic unit of life', difficulty: 'easy', sourceQuote: null },
    { question: 'What is DNA?', answer: 'Genetic material', difficulty: 'easy', sourceQuote: null },
  ],
};

function provider(replies: unknown[]): AiProvider & { calls: number } {
  const p = {
    name: 'fake',
    model: 'claude-opus-5-5',
    calls: 0,
    async generateStructured<T>(_req: StructuredRequest<T>) {
      p.calls += 1;
      const next = replies.shift();
      if (next instanceof Error) throw next;
      return { data: next as T, usage: { inputTokens: 1000, outputTokens: 500 }, model: 'claude-opus-5-5' };
    },
  };
  return p;
}

function setup(opts: { replies?: unknown[]; noProvider?: boolean; env?: Record<string, string> } = {}) {
  const logs: { event: string; fields: LogFields }[] = [];
  const fake = provider(opts.replies ?? [goodDeck]);
  const ctx = createContext(loadConfig({ ALLOWED_ORIGINS: 'http://localhost:8081', ...opts.env }), {
    provider: opts.noProvider ? null : fake,
    log: (event, fields) => logs.push({ event, fields }),
  });
  return { ctx, fake, logs };
}

const NOTES = 'PRIVATE: my secret biology notes about mitochondria and the cell membrane. '.repeat(3);

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://localhost:3001/api/v1/ai/flashcards', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const validBody = { source: { type: 'topic', topic: 'Cells' }, difficulty: 'easy', language: 'English', count: 2 };

describe('POST /api/v1/ai/flashcards', () => {
  it('returns validated AI content with usage metadata', async () => {
    const { ctx } = setup();
    const res = await handleGenerate('flashcards', post(validBody), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      kind: 'flashcards',
      aiGenerated: true,
      deck: { title: 'Cells', cards: [{ question: 'What is a cell?' }, { question: 'What is DNA?' }] },
      meta: { model: 'claude-opus-5-5', attempts: 1, usage: { inputTokens: 1000, outputTokens: 500 } },
    });
    expect(ctx.meter.snapshot()).toMatchObject({ requests: 1, succeeded: 1, inputTokens: 1000, outputTokens: 500 });
  });

  it('gives a clear configuration error when no key is set', async () => {
    const { ctx } = setup({ noProvider: true });
    const res = await handleGenerate('flashcards', post(validBody), ctx);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatchObject({ code: 'ai_not_configured', retryable: false });
  });

  it('rejects invalid input with field details and never calls the provider', async () => {
    const { ctx, fake } = setup();
    const res = await handleGenerate('flashcards', post({ ...validBody, count: 99 }), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).error.fields[0].path).toBe('count');
    expect(fake.calls).toBe(0);
  });

  it('rejects oversized, non-JSON and malformed bodies', async () => {
    const { ctx } = setup({ env: { AI_MAX_BODY_BYTES: '2048' } });
    const big = await handleGenerate('flashcards', post({ ...validBody, source: { type: 'notes', notes: 'x'.repeat(5000) } }), ctx);
    expect(big.status).toBe(413);
    const text = await handleGenerate('flashcards', post('hello', { 'content-type': 'text/plain' }), ctx);
    expect(text.status).toBe(415);
    const broken = await handleGenerate('flashcards', post('{"source":'), ctx);
    expect(broken.status).toBe(400);
  });

  it('rate limits per client and reports Retry-After', async () => {
    const { ctx } = setup({ replies: [goodDeck, goodDeck], env: { AI_RATE_LIMIT_MAX: '1' } });
    expect((await handleGenerate('flashcards', post(validBody, { 'x-forwarded-for': '1.1.1.1' }), ctx)).status).toBe(200);
    const limited = await handleGenerate('flashcards', post(validBody, { 'x-forwarded-for': '1.1.1.1' }), ctx);
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBeTruthy();
    expect((await limited.json()).error.code).toBe('rate_limited');
    expect((await handleGenerate('flashcards', post(validBody, { 'x-forwarded-for': '2.2.2.2' }), ctx)).status).toBe(200);
  });

  it('stops when the daily token budget is used up', async () => {
    const { ctx, fake } = setup({ replies: [goodDeck, goodDeck], env: { AI_DAILY_TOKEN_BUDGET: '1000' } });
    expect((await handleGenerate('flashcards', post(validBody), ctx)).status).toBe(200);
    const over = await handleGenerate('flashcards', post(validBody), ctx);
    expect(over.status).toBe(429);
    expect((await over.json()).error.code).toBe('daily_budget_exhausted');
    expect(fake.calls).toBe(1);
  });

  it('returns 502 for output that stays invalid, and meters the spent tokens', async () => {
    const bad = { deckTitle: 'Cells', cards: [goodDeck.cards[0]] };
    const { ctx, fake } = setup({ replies: [bad, bad] });
    const res = await handleGenerate('flashcards', post(validBody), ctx);
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatchObject({ code: 'invalid_ai_output', retryable: true });
    expect(fake.calls).toBe(2);
    expect(ctx.meter.snapshot()).toMatchObject({ failed: 1, inputTokens: 2000, outputTokens: 1000 });
  });

  it('maps provider timeouts to 504', async () => {
    const { ctx } = setup({ replies: [new ProviderTimeoutError()] });
    const res = await handleGenerate('flashcards', post(validBody), ctx);
    expect(res.status).toBe(504);
    expect((await res.json()).error).toMatchObject({ code: 'ai_timeout', retryable: true });
  });

  it('never logs the notes or anything that looks like a key', async () => {
    const { ctx, logs } = setup();
    await handleGenerate('flashcards', post({ ...validBody, source: { type: 'notes', notes: NOTES } }), ctx);
    const logged = JSON.stringify(logs);
    expect(logs.length).toBeGreaterThan(0);
    expect(logged).not.toContain('PRIVATE');
    expect(logged).not.toContain('mitochondria');
    expect(logged).toContain('"inputChars"');
  });

  it('sends CORS headers only for allowed origins', async () => {
    const { ctx } = setup();
    const allowed = handleOptions(new Request('http://x/api', { headers: { origin: 'http://localhost:8081' } }), ctx);
    expect(allowed.headers.get('access-control-allow-origin')).toBe('http://localhost:8081');
    const denied = handleOptions(new Request('http://x/api', { headers: { origin: 'https://evil.example' } }), ctx);
    expect(denied.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('POST /api/v1/ai/quiz', () => {
  it('validates quiz requests separately', async () => {
    const { ctx } = setup();
    const res = await handleGenerate('quiz', post({ ...validBody, count: 21 }), ctx);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/health', () => {
  it('reports configuration and usage without secrets', async () => {
    const { ctx } = setup({ noProvider: true });
    const res = handleHealth(new Request('http://x/api/v1/health'), ctx);
    const body = await res.json();
    expect(body).toMatchObject({ status: 'ok', ai: { configured: false, model: 'claude-opus-5-5' } });
    expect(JSON.stringify(body)).not.toMatch(/sk-ant|apiKey|ANTHROPIC/);
  });
});
