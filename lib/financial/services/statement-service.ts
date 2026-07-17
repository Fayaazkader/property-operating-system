// lib/financial/services/statement-service.ts
// Statement business logic. Aggregates raw data into financial statements.

import { ledgerData } from '../data/ledger-data';

export interface TrialBalanceRow {
  gl_code: string;
  account_name: string;
  account_type: string;
  total_debits: number;
  total_credits: number;
  net_balance: number;
}

export interface TrialBalanceResult {
  rows: TrialBalanceRow[];
  totalDr: number;
  totalCr: number;
  balanced: boolean;
}

export interface IncomeStatementResult {
  revenue: Array<{ account: string; amount: number }>;
  expenses: Array<{ account: string; amount: number }>;
  total_revenue: number;
  total_expenses: number;
  net_income: number;
}

export const statementService = {
  async getTrialBalance(params: { entityId: string; periodId: string }): Promise<TrialBalanceResult> {
    const entries = await ledgerData.getEntries(params.entityId, params.periodId);

    const accountMap = new Map<string, { account_name: string; gl_code: string; account_type: string; total_debits: number; total_credits: number }>();

    for (const e of entries) {
      const key = e.account_id;
      if (!accountMap.has(key)) {
        accountMap.set(key, { account_name: e.account_name, gl_code: e.gl_code, account_type: e.account_type, total_debits: 0, total_credits: 0 });
      }
      const acc = accountMap.get(key)!;
      acc.total_debits += e.debit_amount;
      acc.total_credits += e.credit_amount;
    }

    const rows: TrialBalanceRow[] = Array.from(accountMap.entries())
      .map(([_, v]) => ({
        gl_code: v.gl_code,
        account_name: v.account_name,
        account_type: v.account_type,
        total_debits: v.total_debits,
        total_credits: v.total_credits,
        net_balance: v.total_debits - v.total_credits,
      }))
      .sort((a, b) => a.gl_code.localeCompare(b.gl_code));

    const totalDr = rows.reduce((s, r) => s + r.total_debits, 0);
    const totalCr = rows.reduce((s, r) => s + r.total_credits, 0);

    return { rows, totalDr, totalCr, balanced: Math.abs(totalDr - totalCr) < 0.01 };
  },

  async getIncomeStatement(params: { entityId: string; periodId: string }): Promise<IncomeStatementResult> {
    const { rows } = await this.getTrialBalance(params);

    const revenue = rows.filter(l => l.account_type === 'income').map(l => ({ account: `${l.gl_code} - ${l.account_name}`, amount: Math.abs(l.net_balance) }));
    const expenses = rows.filter(l => l.account_type === 'expense').map(l => ({ account: `${l.gl_code} - ${l.account_name}`, amount: Math.abs(l.net_balance) }));

    const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

    return { revenue, expenses, total_revenue: totalRevenue, total_expenses: totalExpenses, net_income: totalRevenue - totalExpenses };
  }
};
