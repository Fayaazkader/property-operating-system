// lib/reporting/providers/income-statement.ts
import { financialReportingEngine } from '@/lib/financial/reporting-engine';

export async function getIncomeStatementData(entityId: string, periodId: string) {
  const { balances, total_revenue, total_expenses, net_income } = await financialReportingEngine.getPeriodBalances(entityId, periodId);

  const revenue = balances.filter(b => b.account_type === 'income');
  const expenses = balances.filter(b => b.account_type === 'expense');

  const rows: string[][] = [
    ['REVENUE', '', ''],
    ...revenue.map(b => [b.gl_code, b.account_name, b.display_value.toLocaleString()]),
    ['', 'Total Revenue', total_revenue.toLocaleString()],
    ['', '', ''],
    ['EXPENSES', '', ''],
    ...expenses.map(b => [b.gl_code, b.account_name, b.display_value.toLocaleString()]),
    ['', 'Total Expenses', total_expenses.toLocaleString()],
    ['', '', ''],
    ['', 'NET INCOME', net_income.toLocaleString()],
  ];

  return { headers: ['Code', 'Account', 'Amount'], rows, totals: [] };
}
