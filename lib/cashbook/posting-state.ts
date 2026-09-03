// lib/cashbook/posting-state.ts

export type PostingState =
  | 'unallocated'
  | 'partially_allocated'
  | 'fully_allocated'
  | 'posting'
  | 'posted'
  | 'posting_failed';

export const VALID_TRANSITIONS: Record<PostingState, PostingState[]> = {
  unallocated: ['partially_allocated', 'fully_allocated'],
  partially_allocated: ['unallocated', 'fully_allocated'],
  fully_allocated: ['partially_allocated', 'posting'],
  posting: ['posted', 'posting_failed'],
  posted: [],
  posting_failed: ['fully_allocated', 'posting'],
};

export function canTransition(
  from: PostingState,
  to: PostingState
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextState(
  current: PostingState,
  success: boolean
): PostingState {
  if (current !== 'posting') {
    return current;
  }

  return success ? 'posted' : 'posting_failed';
}