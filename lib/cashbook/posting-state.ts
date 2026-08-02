// lib/cashbook/posting-state.ts
// Posting state machine for bank transactions

export type PostingState = 'unallocated' | 'allocated' | 'fully_allocated' | 'ready_to_post' | 'posting' | 'posted' | 'posting_failed';

export const VALID_TRANSITIONS: Record<PostingState, PostingState[]> = {
  unallocated: ['allocated'],
  allocated: ['ready_to_post', 'fully_allocated', 'unallocated'],
  ready_to_post: ['posting', 'allocated'],
  posting: ['posted', 'posting_failed'],
  posted: [],
  posting_failed: ['ready_to_post'],
};

export function canTransition(from: PostingState, to: PostingState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) || false;
}

export function nextState(current: PostingState, success: boolean): PostingState {
  if (success) {
    if (current === 'ready_to_post' || current === 'posting_failed') return 'posting';
    if (current === 'posting') return 'posted';
  } else {
    if (current === 'posting') return 'posting_failed';
  }
  return current;
}
