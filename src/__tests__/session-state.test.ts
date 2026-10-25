import {
  initialPlayerState,
  nextUnansweredIndex,
  playerReducer,
  resumeIndex,
  type PlayerAction,
  type PlayerState,
} from '@/study/session-state';

const apply = (state: PlayerState, ...actions: PlayerAction[]) => actions.reduce(playerReducer, state);

describe('player navigation', () => {
  it('moves within bounds and hides the answer when moving', () => {
    let s = initialPlayerState(3);
    s = apply(s, { type: 'previous' });
    expect(s.index).toBe(0);
    s = apply(s, { type: 'reveal' }, { type: 'next' });
    expect(s).toMatchObject({ index: 1, revealed: false });
    s = apply(s, { type: 'next' }, { type: 'next' }, { type: 'next' });
    expect(s.index).toBe(2);
    s = apply(s, { type: 'goTo', index: 99 });
    expect(s.index).toBe(2);
    s = apply(s, { type: 'goTo', index: 0 });
    expect(s.index).toBe(0);
  });

  it('clamps the starting index and copes with no items', () => {
    expect(initialPlayerState(3, 10).index).toBe(2);
    expect(apply(initialPlayerState(0), { type: 'next' }).index).toBe(0);
  });

  it('reveals and hides the answer', () => {
    const s = apply(initialPlayerState(2), { type: 'reveal' });
    expect(s.revealed).toBe(true);
    expect(apply(s, { type: 'hide' }).revealed).toBe(false);
  });
});

describe('submitting', () => {
  it('ignores a second submit while one is pending (double-tap guard)', () => {
    const pending = apply(initialPlayerState(3), { type: 'select', option: 1 }, { type: 'submitStart' });
    expect(pending.submitting).toBe(true);
    expect(playerReducer(pending, { type: 'submitStart' })).toBe(pending);
    // Navigation and option changes are frozen while saving, too.
    expect(playerReducer(pending, { type: 'next' })).toBe(pending);
    expect(playerReducer(pending, { type: 'select', option: 2 })).toBe(pending);
  });

  it('advances after a successful save when asked to', () => {
    const s = apply(initialPlayerState(3), { type: 'reveal' }, { type: 'submitStart' }, { type: 'submitSuccess', advance: true });
    expect(s).toMatchObject({ index: 1, submitting: false, revealed: false, error: null });
  });

  it('stays put after a save on the last item or when not advancing', () => {
    expect(apply(initialPlayerState(1), { type: 'submitStart' }, { type: 'submitSuccess', advance: true }).index).toBe(0);
    const quiz = apply(
      initialPlayerState(3),
      { type: 'select', option: 0 },
      { type: 'submitStart' },
      { type: 'submitSuccess', advance: false },
    );
    expect(quiz).toMatchObject({ index: 0, selectedOption: 0, submitting: false });
  });

  it('keeps the choice and shows the error after a failed save, ready to retry', () => {
    const failed = apply(
      initialPlayerState(3),
      { type: 'select', option: 2 },
      { type: 'submitStart' },
      { type: 'submitFailure', error: 'Could not save' },
    );
    expect(failed).toMatchObject({ index: 0, selectedOption: 2, submitting: false, error: 'Could not save' });
    expect(apply(failed, { type: 'submitStart' })).toMatchObject({ submitting: true, error: null });
  });
});

describe('resuming', () => {
  const ids = ['a', 'b', 'c', 'd'];

  it('resumes at the first unanswered item', () => {
    expect(resumeIndex(ids, new Set())).toBe(0);
    expect(resumeIndex(ids, new Set(['a', 'b']))).toBe(2);
    expect(resumeIndex(ids, new Set(['a', 'c']))).toBe(1);
    expect(resumeIndex(ids, new Set(ids))).toBe(3);
    expect(resumeIndex([], new Set())).toBe(0);
  });

  it('finds the next unanswered item, wrapping around', () => {
    expect(nextUnansweredIndex(ids, new Set(['a']), 0)).toBe(1);
    expect(nextUnansweredIndex(ids, new Set(['c', 'd']), 2)).toBe(0);
    expect(nextUnansweredIndex(ids, new Set(ids), 1)).toBeNull();
  });
});
