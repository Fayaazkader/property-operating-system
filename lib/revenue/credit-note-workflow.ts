// lib/revenue/credit-note-workflow.ts

export type CreditNoteStatus =
  | 'draft'
  | 'pending_posting'
  | 'issued'
  | 'posting_failed'
  | 'cancelled'
  | 'reversed';

const VALID_STATUSES = new Set<CreditNoteStatus>([
  'draft', 'pending_posting', 'issued', 'posting_failed', 'cancelled', 'reversed',
]);

export function isCreditNoteStatus(value: string): value is CreditNoteStatus {
  return VALID_STATUSES.has(value as CreditNoteStatus);
}

const allowedTransitions: Record<CreditNoteStatus, CreditNoteStatus[]> = {
  draft: ['pending_posting'],
  pending_posting: ['issued', 'posting_failed'],
  issued: ['cancelled', 'reversed'],
  posting_failed: ['pending_posting', 'cancelled'],
  cancelled: [],
  reversed: [],
};

export function canTransition(current: CreditNoteStatus, target: CreditNoteStatus): boolean {
  return allowedTransitions[current]?.includes(target) ?? false;
}

export function assertTransition(current: CreditNoteStatus, target: CreditNoteStatus): void {
  if (!canTransition(current, target)) {
    throw new Error(`Invalid status transition: ${current} → ${target}`);
  }
}
