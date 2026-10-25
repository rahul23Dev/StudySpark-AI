/** Small HTTP helpers for route handlers: JSON responses, CORS, body limits, client keys. */
import { ApiError } from '@/errors';

export type CorsPolicy = { allowedOrigins: string[] };

export function corsHeaders(request: Request, policy: CorsPolicy): Record<string, string> {
  const origin = request.headers.get('origin');
  if (!origin || !policy.allowedOrigins.includes(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '600',
    vary: 'origin',
  };
}

export function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export function errorResponse(error: ApiError, headers: Record<string, string> = {}): Response {
  const retryAfter = error.details?.retryAfterSeconds;
  return json(
    error.status,
    { error: { code: error.code, message: error.message, retryable: error.retryable, ...(error.details ?? {}) } },
    typeof retryAfter === 'number' ? { ...headers, 'retry-after': String(retryAfter) } : headers,
  );
}

/** Reads a JSON body, refusing anything over `maxBytes` before and after reading it. */
export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw tooLarge(maxBytes);
  const type = request.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) {
    throw new ApiError(415, 'unsupported_media_type', 'Send the request as JSON (content-type: application/json).', false);
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) throw tooLarge(maxBytes);
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, 'invalid_json', 'The request body is not valid JSON.', false);
  }
}

const tooLarge = (maxBytes: number) =>
  new ApiError(413, 'request_too_large', `The request is too large (limit ${Math.round(maxBytes / 1024)} KB).`, false);

/** Identifies the caller for rate limiting (first forwarded IP, else a shared local key). */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || 'local';
}
