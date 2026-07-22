// lib/reporting/providers/balance-sheet.ts
import { financialReportingEngine } from '@/lib/financial/reporting-engine';

export async function getBalanceSheetData(entityId: string, periodId: string) {
  const { balances, total_assets, total_liabilities, total_equity } = await financialReportingEngine.getPeriodBalances(entityId, periodId);

  const assets = balances.filter(b => b.account_type === 'asset');
  const liabilities = balances.filter(b => b.account_type === 'liability');
  const equity = balances.filter(b => b.account_type === 'equity');

  const rows: string[][] = [
    ['ASSETS', '', ''],
    ...assets.map(b => [b.gl_code, b.account_name, b.closing_balance.toLocaleString()]),
    ['', 'Total Assets', total_assets.toLocaleString()],
    ['', '', ''],
    ['LIABILITIES', '', ''],
    ...liabilities.map(b => [b.gl_code, b.account_name, Math.abs(b.closing_balance).toLocaleString()]),
    ['', 'Total Liabilities', total_liabilities.toLocaleString()],
    ['', '', ''],
    ['EQUITY', '', ''],
    ...equity.map(b => [b.gl_code, b.account_name, Math.abs(b.closing_balance).toLocaleString()]),
    ['', 'Retained Earnings', (total_equity - equity.reduce((s, b) => s + Math.abs(b.closing_balance), 0)).toLocaleString()],
    ['', 'Total Equity', total_equity.toLocaleString()],
  ];

  return { headers: ['Code', 'Account', 'Amount'], rows, totals: [] };
}
