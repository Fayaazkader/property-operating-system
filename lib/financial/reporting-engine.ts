// lib/financial/reporting-engine.ts
// Financial Reporting Engine — Single source of truth for all financial reports.
// Income Statement, Balance Sheet, Trial Balance, Cash Flow all consume this.

import { supabase } from '@/lib/supabase';

export interface AccountBalance {
  account_id: string;
  gl_code: string;
  account_name: string;
  account_type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  opening_balance: number;
  period_debits: number;
  period_credits: number;
  closing_balance: number;
  normal_balance: 'debit' | 'credit';
  display_value: number;
}

export interface PeriodBalance {
  period_id: string;
  period_name: string;
  balances: AccountBalance[];
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  total_revenue: number;
  total_expenses: number;
  net_income: number;
}

export const financialReportingEngine = {
  async getPeriodBalances(entityId: string, periodId: string): Promise<PeriodBalance> {
    // Get all GL entries for the period
    const { data: entries } = await supabase
      .from('general_ledger')
      .select('account_id, debit_amount, credit_amount, chart_of_accounts!inner(account_name, gl_code, account_type)')
      .eq('entity_id', entityId)
      .eq('period_id', periodId);

    // Get opening balances from previous closed period
    const { data: prevPeriod } = await supabase
      .from('financial_periods')
      .select('id, period_name')
      .eq('entity_id', entityId)
      .eq('period_type', 'financial')
      .eq('status', 'closed')
      .lt('period_end', new Date().toISOString())
      .order('period_end', { ascending: false })
      .limit(1)
      .single();

    // Aggregate current period
    const accountMap = new Map<string, { name: string; gl: string; type: string; dr: number; cr: number }>();
    for (const e of (entries || [])) {
      const acc = e.chart_of_accounts as any;
      if (!acc) continue;
      const key = e.account_id;
      if (!accountMap.has(key)) accountMap.set(key, { name: acc.account_name, gl: acc.gl_code, type: acc.account_type, dr: 0, cr: 0 });
      const entry = accountMap.get(key)!;
      entry.dr += e.debit_amount || 0;
      entry.cr += e.credit_amount || 0;
    }

    // Get opening balances from previous period
    const openingMap = new Map<string, number>();
    if (prevPeriod) {
      const { data: prevEntries } = await supabase
        .from('general_ledger')
        .select('account_id, debit_amount, credit_amount')
        .eq('entity_id', entityId)
        .eq('period_id', prevPeriod.id);

      const prevMap = new Map<string, { dr: number; cr: number }>();
      for (const e of (prevEntries || [])) {
        if (!prevMap.has(e.account_id)) prevMap.set(e.account_id, { dr: 0, cr: 0 });
        const p = prevMap.get(e.account_id)!;
        p.dr += e.debit_amount || 0;
        p.cr += e.credit_amount || 0;
      }
      for (const [id, vals] of prevMap) {
        openingMap.set(id, vals.dr - vals.cr);
      }
    }

    // Build balances with normal balance calculation
    const balances: AccountBalance[] = [];
    let totalAssets = 0, totalLiabilities = 0, totalEquity = 0, totalRevenue = 0, totalExpenses = 0;

    for (const [accountId, data] of accountMap) {
      const opening = openingMap.get(accountId) || 0;
      const closing = opening + data.dr - data.cr;
      const isAsset = data.type === 'asset';
      const isLiability = data.type === 'liability';
      const isEquity = data.type === 'equity';
      const isIncome = data.type === 'income';
      const isExpense = data.type === 'expense';

      // Normal balance: assets/expenses = debit, liabilities/equity/income = credit
      const normalBalance = (isAsset || isExpense) ? 'debit' as const : 'credit' as const;

      // Display value: normal balance determines sign
      const displayValue = (normalBalance === 'debit') ? closing : -closing;

      const balance: AccountBalance = {
        account_id: accountId,
        gl_code: data.gl,
        account_name: data.name,
        account_type: data.type as any,
        opening_balance: opening,
        period_debits: data.dr,
        period_credits: data.cr,
        closing_balance: closing,
        normal_balance: normalBalance,
        display_value: displayValue,
      };

      balances.push(balance);

      if (isAsset) totalAssets += closing;
      if (isLiability) totalLiabilities += -closing;
      if (isEquity) totalEquity += -closing;
      if (isIncome) totalRevenue += -closing;
      if (isExpense) totalExpenses += closing;
    }

    balances.sort((a, b) => a.gl_code.localeCompare(b.gl_code));

    return {
      period_id: periodId,
      period_name: prevPeriod?.period_name || 'Current',
      balances,
      total_assets: totalAssets,
      total_liabilities: totalLiabilities,
      total_equity: totalEquity + totalRevenue - totalExpenses, // Include retained earnings
      total_revenue: totalRevenue,
      total_expenses: totalExpenses,
      net_income: totalRevenue - totalExpenses,
    };
  },

  async getComparativePeriods(entityId: string, currentPeriodId: string, previousPeriodId: string) {
    const [current, previous] = await Promise.all([
      this.getPeriodBalances(entityId, currentPeriodId),
      this.getPeriodBalances(entityId, previousPeriodId),
    ]);
    return { current, previous };
  }
};
