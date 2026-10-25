/**
 * Client for the StudySpark API (apps/api). The app never talks to an AI provider
 * directly and never holds a provider key: it calls our own server, which owns the
 * key. Responses are validated before use, and there is no offline or sample
 * fallback: if generation fails, the user sees why and can retry.
 */
import { z } from 'zod';

export type GenerationKind = 'flashcards' | 'quiz';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type QuizTypes = 'multiple_choice' | 'true_false' | 'mixed';

export type GenerationSource = { type: 'topic'; topic: string } | { type: 'notes'; notes: string };

export type GenerationRequest = {
  source: GenerationSource;
  difficulty: Difficulty;
  language: string;
  count: number;
  /** Quiz only. */
  questionTypes?: QuizTypes;
};

/** Mirrors the server's limits so most mistakes are caught before a request is sent. */
export const AI_LIMITS = {
  topic: { min: 2, max: 200 },
  notes: { min: 40, max: 20_000 },
  flashcards: { max: 30 },
  quiz: { max: 20 },
} as const;

const meta = z.object({
  requestId: z.string(),
  model: z.string(),
  attempts: z.number().int(),
  usage: z.object({ inputTokens: z.number(), outputTokens: z.number() }),
});

const FlashcardResponse = z.object({
  kind: z.literal('flashcards'),
  aiGenerated: z.literal(true),
  deck: z.object({
    title: z.string().min(1).max(80),
    cards: z
      .array(
        z.object({
          question: z.string().min(1).max(1000),
          answer: z.string().min(1).max(2000),
          difficulty: z.enum(['easy', 'medium', 'hard']),
          sourceQuote: z.string().optional(),
        }),
      )
      .min(1),
  }),
  meta,
});

const QuizResponse = z.object({
  kind: z.literal('quiz'),
  aiGenerated: z.literal(true),
  quiz: z.object({
    title: z.string().min(1).max(80),
    questions: z
      .array(
        z
          .object({
            type: z.enum(['multiple_choice', 'true_false']),
            question: z.string().min(1).max(500),
            options: z.array(z.string().min(1).max(300)).min(2).max(6),
            correctAnswerIndex: z.number().int().min(0),
            explanation: z.string().max(1000),
            sourceQuote: z.string().optional(),
          })
          .refine((q) => q.correctAnswerIndex < q.options.length, 'correct answer out of range'),
      )
      .min(1),
  }),
  meta,
});

export type FlashcardGeneration = z.infer<typeof FlashcardResponse>;
export type QuizGeneration = z.infer<typeof QuizResponse>;
export type Generation = FlashcardGeneration | QuizGeneration;

const ErrorBody = z.object({
  error: z.object({ code: z.string(), message: z.string(), retryable: z.boolean() }).loose(),
});

/** A failed generation, with a user-facing message and whether retrying may help. */
export class AiClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'AiClientError';
  }
}

/** Long enough for the server's own bounded retries (it gives up after 150 s). */
export const CLIENT_TIMEOUT_MS = 160_000;

export function apiBaseUrl(env: Record<string, string | undefined> = process.env): string | null {
  // Read as a literal so Expo inlines EXPO_PUBLIC_ variables at build time.
  const value = env === process.env ? process.env.EXPO_PUBLIC_API_BASE_URL : env.EXPO_PUBLIC_API_BASE_URL;
  const trimmed = value?.trim().replace(/\/+$/, '');
  return trimmed ? trimmed : null;
}

export async function generate(
  kind: GenerationKind,
  request: GenerationRequest,
  options: { signal?: AbortSignal; baseUrl?: string | null; fetchImpl?: typeof fetch } = {},
): Promise<Generation> {
  const base = options.baseUrl === undefined ? apiBaseUrl() : options.baseUrl;
  if (!base) {
    throw new AiClientError(
      'app_not_configured',
      'AI features need the StudySpark server address. Set EXPO_PUBLIC_API_BASE_URL in .env.local and restart Expo.',
      false,
    );
  }
  const body = kind === 'quiz' ? request : { ...request, questionTypes: undefined };
  // A plain AbortController (AbortSignal.timeout/any aren't reliable on React Native).
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, CLIENT_TIMEOUT_MS);
  const cancel = () => controller.abort();
  options.signal?.addEventListener('abort', cancel);

  let res: Response;
  try {
    if (options.signal?.aborted) controller.abort();
    res = await (options.fetchImpl ?? fetch)(`${base}/api/v1/ai/${kind}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    if (options.signal?.aborted) throw new AiClientError('cancelled', 'Generation cancelled.', true);
    if (timedOut) throw new AiClientError('timeout', 'The server took too long to answer. Please try again.', true);
    throw new AiClientError(
      'network',
      `Can't reach the StudySpark server at ${base}. Check that it's running and that this device is on the same network.`,
      true,
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    throw new AiClientError('bad_response', 'The server sent an unreadable response. Please try again.', true, res.status);
  }

  if (!res.ok) {
    const parsed = ErrorBody.safeParse(payload);
    if (parsed.success) {
      const { code, message, retryable } = parsed.data.error;
      throw new AiClientError(code, message, retryable, res.status);
    }
    throw new AiClientError('server_error', `The server returned an error (${res.status}). Please try again.`, true, res.status);
  }

  const parsed = (kind === 'flashcards' ? FlashcardResponse : QuizResponse).safeParse(payload);
  if (!parsed.success) {
    throw new AiClientError('bad_response', "The server's answer didn't look right, so nothing was used. Please try again.", true);
  }
  return parsed.data;
}
