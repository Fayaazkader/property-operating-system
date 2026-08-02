// lib/revenue/warning-engine.ts

export interface WarningContext {
  chargesCount: number;
  hasEscalation: boolean;
  hasInterest: boolean;
  hasLateFee: boolean;
}

export function evaluateWarnings(ctx: WarningContext): string[] {
  const warnings: string[] = [];
  if (ctx.chargesCount === 0) warnings.push('No billing rules for this period');
  if (ctx.hasEscalation) warnings.push('Escalation applied — review rental amount');
  if (ctx.hasInterest) warnings.push('Interest charge pending approval');
  if (ctx.hasLateFee) warnings.push('Late fee pending approval');
  return warnings;
}
