import type { DeckSort } from '@/data/types';

export const DECK_SORT_OPTIONS: readonly { value: DeckSort; label: string }[] = [
  { value: 'updated', label: 'Recent' },
  { value: 'created', label: 'Newest' },
  { value: 'title', label: 'A–Z' },
  { value: 'custom', label: 'My order' },
];

export const cardCountLabel = (n: number) => `${n} ${n === 1 ? 'card' : 'cards'}`;

/** "25 Oct" this year, "25 Oct 2025" otherwise. */
export function shortDate(iso: string, today = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const sameYear = date.getFullYear() === today.getFullYear();
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** First validation message per field, for showing next to inputs. */
export function fieldErrors(error: unknown): Record<string, string> | null {
  if (error && typeof error === 'object' && 'issues' in error) {
    return (error as { issues: Record<string, string> }).issues;
  }
  return null;
}

/** When a card is next due: "Due now", "Due in 10 minutes", "Due in 5 hours", or "Due 3 Nov". */
export function dueLabel(dueAt: string | null, now = new Date()): string {
  if (dueAt === null) return 'New card · due now';
  const ms = new Date(dueAt).getTime() - now.getTime();
  if (Number.isNaN(ms) || ms <= 0) return 'Due now';
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `Due in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Due in ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  return `Due ${shortDate(dueAt, now)}`;
}
