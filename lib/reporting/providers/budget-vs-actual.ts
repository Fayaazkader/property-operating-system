// lib/reporting/providers/budget-vs-actual.ts
import { supabase } from '@/lib/supabase';
import { financialReportingEngine } from '@/lib/financial/reporting-engine';

export async function getBudgetVsActualData(entityId: string, periodId: string) {
  const { balances } = await financialReportingEngine.getPeriodBalances(entityId, periodId);
  const { data: budgets } = await supabase.from('budgets').select('*').eq('entity_id', entityId).eq('period_id', periodId);

  const budgetMap = new Map<string, { period: number; annual: number }>();
  (budgets || []).forEach(b => {
    budgetMap.set(b.account_id, { period: (budgetMap.get(b.account_id)?.period || 0) + (b.budgeted_amount || 0), annual: (b.budget_type === 'annual' ? b.budgeted_amount : 0) });
  });

  // Keep numbers until final format
  const accountRows: { code: string; name: string; budgeted: number; actual: number; variance: number; variancePct: number; ytd: number; annual: number; remaining: number }[] = [];

  for (const b of balances.filter(b => b.account_type === 'income' || b.account_type === 'expense')) {
    const budgetData = budgetMap.get(b.account_id) || { period: 0, annual: 0 };
    const actual = b.display_value;
    const variance = actual - budgetData.period;
    const variancePct = budgetData.period > 0 ? Math.round((variance / budgetData.period) * 100 * 10) / 10 : 0;
    accountRows.push({ code: b.gl_code, name: b.account_name, budgeted: budgetData.period, actual, variance, variancePct, ytd: actual, annual: budgetData.annual, remaining: budgetData.annual - actual });
  }

  const rows = accountRows.map(r => [r.code, r.name, r.budgeted.toLocaleString(), r.actual.toLocaleString(), r.variance.toLocaleString(), `${r.variancePct}%`, r.ytd.toLocaleString(), r.annual.toLocaleString(), r.remaining.toLocaleString()]);

  // Totals from numeric values
  const totalBudget = accountRows.reduce((s, r) => s + r.budgeted, 0);
  const totalActual = accountRows.reduce((s, r) => s + r.actual, 0);
  const totalVar = totalActual - totalBudget;
  const totalVarPct = totalBudget > 0 ? Math.round((totalVar / totalBudget) * 100 * 10) / 10 : 0;
  const totalYtd = accountRows.reduce((s, r) => s + r.ytd, 0);
  const totalAnnual = accountRows.reduce((s, r) => s + r.annual, 0);

  return {
    headers: ['Code', 'Account', 'Budget', 'Actual', 'Variance', '%', 'YTD', 'Annual', 'Remaining'],
    rows,
    totals: ['', 'TOTAL', totalBudget.toLocaleString(), totalActual.toLocaleString(), totalVar.toLocaleString(), `${totalVarPct}%`, totalYtd.toLocaleString(), totalAnnual.toLocaleString(), (totalAnnual - totalActual).toLocaleString()],
  };
}
