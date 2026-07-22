// lib/reporting/providers/trial-balance.ts
import { financialReportingEngine } from '@/lib/financial/reporting-engine';

export async function getTrialBalanceData(entityId: string, periodId: string) {
  const { balances } = await financialReportingEngine.getPeriodBalances(entityId, periodId);
  
  if (!balances.length) return { headers: ['GL Code', 'Account', 'Type', 'Debit', 'Credit'], rows: [], totals: [] };

  const totalDr = balances.reduce((s, b) => s + b.period_debits, 0);
  const totalCr = balances.reduce((s, b) => s + b.period_credits, 0);

  return {
    headers: ['GL Code', 'Account', 'Type', 'Debit', 'Credit'],
    rows: balances.map(b => [b.gl_code, b.account_name, b.account_type, b.period_debits.toLocaleString(), b.period_credits.toLocaleString()]),
    totals: ['', '', 'TOTAL', totalDr.toLocaleString(), totalCr.toLocaleString()],
  };
}
