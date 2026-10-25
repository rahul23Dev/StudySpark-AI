import { getContext } from '@/server/context';
import { handleHealth, handleOptions } from '@/server/handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return handleHealth(request, getContext());
}

export function OPTIONS(request: Request) {
  return handleOptions(request, getContext());
}
