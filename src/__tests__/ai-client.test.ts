import { AiClientError, apiBaseUrl, generate, type GenerationRequest } from '@/ai/client';

const request: GenerationRequest = {
  source: { type: 'topic', topic: 'Cells' },
  difficulty: 'easy',
  language: 'English',
  count: 2,
  questionTypes: 'mixed',
};

const flashcardPayload = {
  kind: 'flashcards',
  aiGenerated: true,
  deck: {
    title: 'Cells',
    cards: [
      { question: 'What is a cell?', answer: 'Unit of life', difficulty: 'easy' },
      { question: 'What is DNA?', answer: 'Genetic code', difficulty: 'easy', sourceQuote: 'DNA carries genes' },
    ],
  },
  meta: { requestId: 'r1', model: 'claude-opus-5-5', attempts: 1, usage: { inputTokens: 10, outputTokens: 20 } },
};

function fakeFetch(status: number, body: unknown) {
  return jest.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })) as unknown as typeof fetch;
}

const base = 'http://192.168.1.3:3001';

describe('AI client', () => {
  it('posts to our own server and returns validated content', async () => {
    const fetchImpl = fakeFetch(200, flashcardPayload);
    const result = await generate('flashcards', request, { baseUrl: base, fetchImpl });
    expect(result.kind).toBe('flashcards');
    const [url, init] = (fetchImpl as jest.Mock).mock.calls[0];
    expect(url).toBe('http://192.168.1.3:3001/api/v1/ai/flashcards');
    const sent = JSON.parse(init.body);
    expect(sent).toEqual({ source: request.source, difficulty: 'easy', language: 'English', count: 2 });
    expect(JSON.stringify(init)).not.toMatch(/api[-_]?key|x-api-key|sk-ant/i);
  });

  it('explains when the server address is not configured', async () => {
    const error = await generate('flashcards', request, { baseUrl: null }).catch((e) => e);
    expect(error).toBeInstanceOf(AiClientError);
    expect(error).toMatchObject({ code: 'app_not_configured', retryable: false });
    expect(error.message).toMatch(/EXPO_PUBLIC_API_BASE_URL/);
  });

  it('passes on the server error code and message', async () => {
    const fetchImpl = fakeFetch(503, {
      error: { code: 'ai_not_configured', message: 'AI generation is not set up on the server yet.', retryable: false },
    });
    await expect(generate('quiz', request, { baseUrl: base, fetchImpl })).rejects.toMatchObject({
      code: 'ai_not_configured',
      status: 503,
      retryable: false,
    });
  });

  it('reports network failures as retryable, naming the server', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    const error = await generate('flashcards', request, { baseUrl: base, fetchImpl }).catch((e) => e);
    expect(error).toMatchObject({ code: 'network', retryable: true });
    expect(error.message).toContain(base);
  });

  it('rejects malformed or unexpected success payloads instead of using them', async () => {
    const bad = { ...flashcardPayload, deck: { title: 'Cells', cards: [] } };
    await expect(generate('flashcards', request, { baseUrl: base, fetchImpl: fakeFetch(200, bad) })).rejects.toMatchObject({
      code: 'bad_response',
    });
    await expect(generate('flashcards', request, { baseUrl: base, fetchImpl: fakeFetch(200, 'not json') })).rejects.toMatchObject({
      code: 'bad_response',
    });
    const wrongIndex = {
      kind: 'quiz',
      aiGenerated: true,
      quiz: { title: 'Q', questions: [{ type: 'true_false', question: 'Q?', options: ['True', 'False'], correctAnswerIndex: 2, explanation: '' }] },
      meta: flashcardPayload.meta,
    };
    await expect(generate('quiz', request, { baseUrl: base, fetchImpl: fakeFetch(200, wrongIndex) })).rejects.toMatchObject({
      code: 'bad_response',
    });
  });

  it('can be cancelled', async () => {
    const controller = new AbortController();
    const fetchImpl = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    ) as unknown as typeof fetch;
    const pending = generate('flashcards', request, { baseUrl: base, fetchImpl, signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'cancelled' });
  });

  it('reads and normalises the configured base URL', () => {
    expect(apiBaseUrl({ EXPO_PUBLIC_API_BASE_URL: ' http://localhost:3001/ ' })).toBe('http://localhost:3001');
    expect(apiBaseUrl({})).toBeNull();
  });
});
