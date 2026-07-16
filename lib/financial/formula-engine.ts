// lib/financial/formula-engine.ts
// Constrained Formula Engine — No eval(). Validated at template creation.

export class FormulaEngine {
  evaluate(formula: string, context: Record<string, number>): number {
    const amount = context.amount || 0;
    const vat = context.vat || 0;
    const vatRate = context.vat_rate || 0;
    const monthlyRental = context.monthly_rental || 0;
    const deposit = context.deposit || 0;
    const recoveries = context.recoveries || 0;
    const interest = context.interest || 0;
    const commission = context.commission || 0;
    const budget = context.budget || 0;

    switch (formula) {
      case '{{amount}}': return amount;
      case '{{vat}}': return vat;
      case '{{amount_plus_vat}}': return amount + vat;
      case '{{amount_minus_vat}}': return amount - vat;
      case '{{monthly_rental}}': return monthlyRental;
      case '{{deposit}}': return deposit;
      case '{{recoveries}}': return recoveries;
      case '{{interest}}': return interest;
      case '{{commission}}': return commission;
      case '{{budget}}': return budget;
      case '{{percentage(amount,15)}}': return Math.round(amount * 0.15 * 100) / 100;
      case '{{vat_fraction(amount,15)}}': return Math.round(amount * (vatRate / (100 + vatRate)) * 100) / 100;
      default: return 0;
    }
  }

  evaluateCondition(condition: string | undefined, context: Record<string, number>): boolean {
    if (!condition) return true;
    if (condition === '{{vat > 0}}') return (context.vat || 0) > 0;
    if (condition === '{{amount > 0}}') return (context.amount || 0) > 0;
    if (condition === '{{deposit > 0}}') return (context.deposit || 0) > 0;
    return true;
  }

  validateFormula(formula: string): boolean {
    const validFormulas = [
      '{{amount}}', '{{vat}}', '{{amount_plus_vat}}', '{{amount_minus_vat}}',
      '{{monthly_rental}}', '{{deposit}}', '{{recoveries}}', '{{interest}}',
      '{{commission}}', '{{budget}}',
      '{{percentage(amount,15)}}', '{{vat_fraction(amount,15)}}',
    ];
    return validFormulas.includes(formula);
  }
}

export const formulaEngine = new FormulaEngine();
