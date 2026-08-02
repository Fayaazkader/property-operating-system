// lib/revenue/escalation-calculator.ts

export interface EscalationResult {
  applies: boolean;
  increase: number;
  yearsOfEscalation: number;
}

export function calculateEscalation(
  monthlyRental: number,
  escalationPercent: number,
  commencementDate: string | null,
  leaseStartDate: string,
  periodStart: string
): EscalationResult {
  if (!escalationPercent || escalationPercent <= 0) {
    return { applies: false, increase: 0, yearsOfEscalation: 0 };
  }

  const effectiveDate = new Date(commencementDate || leaseStartDate);
  const periodDate = new Date(periodStart);
  const monthsSinceStart = (periodDate.getFullYear() - effectiveDate.getFullYear()) * 12 + (periodDate.getMonth() - effectiveDate.getMonth());

  if (monthsSinceStart <= 0 || monthsSinceStart % 12 !== 0) {
    return { applies: false, increase: 0, yearsOfEscalation: 0 };
  }

  const yearsOfEscalation = Math.floor(monthsSinceStart / 12);
  const factor = Math.pow(1 + escalationPercent / 100, yearsOfEscalation);
  const prevFactor = Math.pow(1 + escalationPercent / 100, yearsOfEscalation - 1);
  const increase = Math.round(monthlyRental * (factor - prevFactor) * 100) / 100;

  return { applies: true, increase, yearsOfEscalation };
}
