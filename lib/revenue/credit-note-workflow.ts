// lib/revenue/credit-note-workflow.ts
// Centralized state machine for credit note transitions

const allowedTransitions: Record<string, string[]> = {
  draft: ['pending_posting'],
  pending_posting: ['issued', 'posting_failed'],
  issued: ['cancelled', 'reversed'],
  posting_failed: ['pending_posting', 'cancelled'],
  cancelled: [],
  reversed: [],
};

export function canTransition(current: string, target: string): boolean {
  return allowedTransitions[current]?.includes(target) ?? false;
}

export function assertTransition(current: string, target: string): void {
  if (!canTransition(current, target)) {
    throw new Error(`Invalid status transition: ${current} → ${target}`);
  }
}
