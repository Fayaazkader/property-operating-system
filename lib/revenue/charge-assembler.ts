// lib/revenue/charge-assembler.ts

import { calculateEscalation } from './escalation-calculator';

export interface BillingCharge {
  type: string;
  description: string;
  amount: number;
  vatAmount: number;
  total: number;
  source: string;
  status: string;
  glCode?: string;
}

export function assembleCharges(
  rules: any[],
  manuals: any[],
  interestItems: any[],
  lateFeeItems: any[],
  lease: any,
  periodStart: string,
  periodEnd: string
): { charges: BillingCharge[]; hasEscalation: boolean; hasInterest: boolean; hasLateFee: boolean } {
  const charges: BillingCharge[] = [];
  let hasEscalation = false;
  const hasInterest = interestItems.length > 0;
  const hasLateFee = lateFeeItems.length > 0;

  // Rules
  for (const r of rules) {
    const effectiveFrom = r.effective_from ? new Date(r.effective_from) : null;
    const effectiveTo = r.effective_to ? new Date(r.effective_to) : null;
    const pStart = new Date(periodStart);
    const pEnd = new Date(periodEnd);
    if (effectiveFrom && effectiveFrom > pEnd) continue;
    if (effectiveTo && effectiveTo < pStart) continue;

    const vat = Math.round(r.base_amount * (r.vat_rate / 100) * 100) / 100;
    charges.push({
      type: r.rule_type, description: r.description, amount: r.base_amount,
      vatAmount: vat, total: r.base_amount + vat, source: 'lease',
      status: 'posted', glCode: r.gl_code,
    });
  }

  // Manuals
  for (const m of manuals) {
    const vat = Math.round(m.amount * ((m.vat_rate || 15) / 100) * 100) / 100;
    charges.push({
      type: 'manual', description: m.description, amount: m.amount,
      vatAmount: vat, total: m.amount + vat, source: 'manual',
      status: 'posted', glCode: m.gl_code,
    });
  }

  // Interest
  for (const inv of interestItems) {
    charges.push({
      type: 'interest', description: `Interest — ${inv.description || 'Late Payment'}`,
      amount: inv.amount, vatAmount: 0, total: inv.amount, source: 'interest', status: 'suggested',
    });
  }

  // Late fees
  for (const lf of lateFeeItems) {
    charges.push({
      type: 'late_fee', description: `Late Fee — ${lf.description || 'Overdue'}`,
      amount: lf.amount, vatAmount: 0, total: lf.amount, source: 'late_fee', status: 'suggested',
    });
  }

  // Escalation
  const esc = calculateEscalation(
    lease.monthly_rental, lease.escalation_percent,
    lease.commencement_date, lease.lease_start_date, periodStart
  );
  if (esc.applies) {
    const vat = Math.round(esc.increase * 0.15 * 100) / 100;
    charges.push({
      type: 'escalation', description: `Annual Escalation (${lease.escalation_percent}%)`,
      amount: esc.increase, vatAmount: vat, total: esc.increase + vat,
      source: 'escalation', status: 'suggested',
    });
    hasEscalation = true;
  }

  return { charges, hasEscalation, hasInterest, hasLateFee };
}
