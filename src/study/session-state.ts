/**
 * Pure state for the flashcard player and quiz screens: where the learner is, whether
 * the answer is showing, the chosen option, and whether a save is in flight. Saving
 * itself happens in the screen; this reducer only tracks it, and refuses a second
 * submit while one is pending so a double tap can't record two answers.
 */
export type PlayerState = {
  index: number;
  count: number;
  revealed: boolean;
  selectedOption: number | null;
  submitting: boolean;
  error: string | null;
};

export type PlayerAction =
  | { type: 'goTo'; index: number }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'reveal' }
  | { type: 'hide' }
  | { type: 'select'; option: number }
  | { type: 'submitStart' }
  | { type: 'submitSuccess'; advance: boolean }
  | { type: 'submitFailure'; error: string }
  | { type: 'reset'; count: number; index: number };

export function initialPlayerState(count: number, index = 0): PlayerState {
  return { index: clamp(index, count), count, revealed: false, selectedOption: null, submitting: false, error: null };
}

const clamp = (index: number, count: number) => (count === 0 ? 0 : Math.min(Math.max(index, 0), count - 1));

function moveTo(state: PlayerState, index: number): PlayerState {
  const next = clamp(index, state.count);
  if (next === state.index || state.submitting) return state;
  return { ...state, index: next, revealed: false, selectedOption: null, error: null };
}

export function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case 'goTo':
      return moveTo(state, action.index);
    case 'next':
      return moveTo(state, state.index + 1);
    case 'previous':
      return moveTo(state, state.index - 1);
    case 'reveal':
      return state.revealed ? state : { ...state, revealed: true };
    case 'hide':
      return state.revealed && !state.submitting ? { ...state, revealed: false } : state;
    case 'select':
      return state.submitting ? state : { ...state, selectedOption: action.option, error: null };
    case 'submitStart':
      // Ignored while a save is pending: this is the double-tap guard.
      return state.submitting ? state : { ...state, submitting: true, error: null };
    case 'submitSuccess': {
      const done = { ...state, submitting: false, error: null };
      return action.advance && state.index < state.count - 1
        ? { ...done, index: state.index + 1, revealed: false, selectedOption: null }
        : done;
    }
    case 'submitFailure':
      return { ...state, submitting: false, error: action.error };
    case 'reset':
      return initialPlayerState(action.count, action.index);
  }
}

/** Where to resume: the first unanswered item, or the last item if all are answered. */
export function resumeIndex(itemIds: readonly string[], answered: ReadonlySet<string>): number {
  const first = itemIds.findIndex((id) => !answered.has(id));
  return first === -1 ? Math.max(itemIds.length - 1, 0) : first;
}

/** Next unanswered item after `from`, wrapping around; null when everything is answered. */
export function nextUnansweredIndex(itemIds: readonly string[], answered: ReadonlySet<string>, from: number): number | null {
  for (let step = 1; step <= itemIds.length; step += 1) {
    const i = (from + step) % itemIds.length;
    if (!answered.has(itemIds[i])) return i;
  }
  return null;
}
