/**
 * Route logic, separated from Next.js so it can be unit-tested with plain Requests.
 * Order per request: CORS -> rate limit -> body size/shape -> credentials ->
 * daily budget -> concurrency -> generate (bounded retries, overall deadline).
 */
import { randomUUID } from 'node:crypto';

import type { z } from 'zod';

import { generateFlashcards, generateQuiz, type Generated } from '@/ai/generate';
import { usageOf, type AiProvider } from '@/ai/provider';
import { FlashcardRequestSchema, QuizRequestSchema, type FlashcardRequest, type QuizRequest } from '@/ai/schemas';
import { ApiError, NotConfiguredError } from '@/errors';

import type { ServerContext } from './context';
import { clientKey, corsHeaders, errorResponse, json, readJsonBody } from './http';

export type GenerationKind = 'flashcards' | 'quiz';

/** Upper bound on one request, however many attempts and retries it takes. */
const MAX_REQUEST_MS = 150_000;

export function handleOptions(request: Request, ctx: ServerContext): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request, ctx.config) });
}

export function handleHealth(request: Request, ctx: ServerContext): Response {
  return json(
    200,
    {
      status: 'ok',
      service: 'studyspark-api',
      version: 1,
      ai: {
        configured: ctx.provider !== null,
        provider: ctx.provider?.name ?? null,
        model: ctx.config.model,
      },
      limits: {
        requestsPerWindow: ctx.config.rateLimit.maxRequests,
        windowSeconds: Math.round(ctx.config.rateLimit.windowMs / 1000),
        maxConcurrent: ctx.config.maxConcurrent,
        maxBodyBytes: ctx.config.maxBodyBytes,
      },
      usage: ctx.meter.snapshot(),
    },
    corsHeaders(request, ctx.config),
  );
}

export async function handleGenerate(kind: GenerationKind, request: Request, ctx: ServerContext): Promise<Response> {
  const cors = corsHeaders(request, ctx.config);
  const requestId = randomUUID();
  const started = Date.now();
  const fail = (error: ApiError) => {
    ctx.log('ai.request.rejected', { requestId, kind, code: error.code, status: error.status });
    return errorResponse(error, cors);
  };

  const limit = ctx.rateLimiter.take(clientKey(request));
  if (!limit.allowed) {
    return fail(
      new ApiError(429, 'rate_limited', 'Too many requests. Please wait a moment and try again.', true, {
        retryAfterSeconds: limit.retryAfterSeconds,
      }),
    );
  }

  let body: unknown;
  try {
    body = await readJsonBody(request, ctx.config.maxBodyBytes);
  } catch (error) {
    if (error instanceof ApiError) return fail(error);
    throw error;
  }

  // Parse once per kind, keeping a generation step typed for that kind.
  type Step = (provider: AiProvider, opts: { maxAttempts: number; signal: AbortSignal }) => Promise<Generated<unknown>>;
  let req: FlashcardRequest | QuizRequest;
  let generate: Step;
  let issues: z.core.$ZodIssue[] | null = null;
  if (kind === 'flashcards') {
    const parsed = FlashcardRequestSchema.safeParse(body);
    if (!parsed.success) issues = parsed.error.issues;
    req = parsed.data!;
    generate = (p, o) => generateFlashcards(p, parsed.data!, o);
  } else {
    const parsed = QuizRequestSchema.safeParse(body);
    if (!parsed.success) issues = parsed.error.issues;
    req = parsed.data!;
    generate = (p, o) => generateQuiz(p, parsed.data!, o);
  }
  if (issues) {
    return fail(
      new ApiError(400, 'invalid_request', 'Some request fields are missing or invalid.', false, {
        fields: issues.slice(0, 10).map((i) => ({ path: i.path.join('.'), message: i.message })),
      }),
    );
  }

  const provider = ctx.provider;
  if (!provider) return fail(new NotConfiguredError());
  if (!ctx.meter.hasBudget()) {
    return fail(
      new ApiError(429, 'daily_budget_exhausted', "Today's AI generation limit has been reached. Please try again tomorrow.", false),
    );
  }
  const release = ctx.concurrency.tryAcquire();
  if (!release) {
    return fail(new ApiError(503, 'busy', 'The server is busy with other generations. Please try again shortly.', true));
  }

  const inputChars = req.source.type === 'notes' ? req.source.notes.length : req.source.topic.length;
  const maxAttempts = ctx.config.maxValidationAttempts;
  const signal = AbortSignal.timeout(MAX_REQUEST_MS);
  try {
    const generated = await generate(provider, { maxAttempts, signal });
    ctx.meter.record(generated.meta.model, 'succeeded', generated.meta.usage);
    ctx.log('ai.request.succeeded', {
      requestId,
      kind,
      sourceType: req.source.type,
      inputChars,
      count: req.count,
      attempts: generated.meta.attempts,
      inputTokens: generated.meta.usage.inputTokens,
      outputTokens: generated.meta.usage.outputTokens,
      durationMs: Date.now() - started,
    });
    return json(
      200,
      {
        kind,
        aiGenerated: true,
        [kind === 'flashcards' ? 'deck' : 'quiz']: generated.result,
        meta: { requestId, ...generated.meta },
      },
      cors,
    );
  } catch (error) {
    ctx.meter.record(provider.model, 'failed', usageOf(error));
    const apiError =
      error instanceof ApiError ? error : new ApiError(500, 'internal_error', 'Something went wrong. Please try again.', true);
    ctx.log('ai.request.failed', {
      requestId,
      kind,
      sourceType: req.source.type,
      inputChars,
      code: apiError.code,
      errorName: error instanceof Error ? error.name : 'unknown',
      durationMs: Date.now() - started,
    });
    return errorResponse(apiError, cors);
  } finally {
    release();
  }
}
