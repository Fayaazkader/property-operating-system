// lib/lease/deposit-status.ts
// Business status — operational view. Separate from register status.

export type DepositBusinessStatus =
  | 'required'
  | 'awaiting_payment'
  | 'paid'
  | 'held'
  | 'partially_claimed'
  | 'partially_refunded'
  | 'refunded'
  | 'closed';

export const DEPOSIT_BUSINESS_FLOW: Record<DepositBusinessStatus, string> = {
  required: 'Deposit required per lease',
  awaiting_payment: 'Invoice raised, awaiting tenant payment',
  paid: 'Deposit received in full',
  held: 'Deposit held in trust account',
  partially_claimed: 'Part of deposit claimed for damages/arrears',
  partially_refunded: 'Part of deposit refunded to tenant',
  refunded: 'Full deposit refunded',
  closed: 'Deposit closed',
};

export function determineBusinessStatus(register: {
  original_amount: number;
  amount_received?: number;
  amount_claimed: number;
  amount_refunded: number;
  status: string;
}): DepositBusinessStatus {
  const received = register.amount_received || 0;

  if (register.status === 'closed') return 'closed';
  if (register.amount_refunded >= register.original_amount) return 'refunded';
  if (register.amount_refunded > 0 && register.amount_refunded < register.original_amount) return 'partially_refunded';
  if (register.amount_claimed > 0 && register.amount_claimed < register.original_amount) return 'partially_claimed';
  if (received >= register.original_amount) return 'held';
  if (received > 0) return 'awaiting_payment';
  return 'required';
}
