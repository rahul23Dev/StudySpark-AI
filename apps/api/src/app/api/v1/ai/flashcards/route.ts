import { getContext } from '@/server/context';
import { handleGenerate, handleOptions } from '@/server/handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 160;

export function POST(request: Request) {
  return handleGenerate('flashcards', request, getContext());
}

export function OPTIONS(request: Request) {
  return handleOptions(request, getContext());
}
