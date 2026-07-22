// lib/financial/reporting-engine.ts
// Financial Reporting Engine — Single source of truth for all financial reports.
// Opening balances from official close snapshots, not recalculated.

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
  retained_earnings: number;
}

export const financialReportingEngine = {
  async getPeriodBalances(entityId: string, periodId: string): Promise<PeriodBalance> {
    // Get current period entries
    const { data: entries } = await supabase
      .from('general_ledger')
      .select('account_id, debit_amount, credit_amount, chart_of_accounts!inner(account_name, gl_code, account_type)')
      .eq('entity_id', entityId)
      .eq('period_id', periodId);

    // Get opening balances from official close snapshot — immutable
    const { data: period } = await supabase
      .from('financial_periods')
      .select('period_start')
      .eq('id', periodId)
      .single();

    // Find the most recent closed period BEFORE this one
    const { data: prevClosed } = await supabase
      .from('financial_periods')
      .select('id, period_name')
      .eq('entity_id', entityId)
      .eq('period_type', 'financial')
      .eq('status', 'closed')
      .lt('period_end', period?.period_start || new Date().toISOString())
      .order('period_end', { ascending: false })
      .limit(1)
      .single();

    // Get opening balances from the financial_statements snapshot (immutable)
    const openingMap = new Map<string, number>();
    let retainedEarnings = 0;

    if (prevClosed) {
      const { data: snapshot } = await supabase
        .from('financial_statements')
        .select('statement_data')
        .eq('entity_id', entityId)
        .eq('period_id', prevClosed.id)
        .eq('statement_type', 'trial_balance')
        .single();

      if (snapshot?.statement_data?.rows) {
        for (const row of snapshot.statement_data.rows) {
          openingMap.set(row.account_id, row.net_balance || 0);
        }
      }

      // Retained earnings from balance sheet snapshot
      const { data: bsSnapshot } = await supabase
        .from('financial_statements')
        .select('statement_data')
        .eq('entity_id', entityId)
        .eq('period_id', prevClosed.id)
        .eq('statement_type', 'balance_sheet')
        .single();

      if (bsSnapshot?.statement_data?.total_equity) {
        retainedEarnings = bsSnapshot.statement_data.total_equity || 0;
      }
    }

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

    // Build balances
    const balances: AccountBalance[] = [];
    let totalAssets = 0, totalLiabilities = 0, totalEquity = 0, totalRevenue = 0, totalExpenses = 0;

    for (const [accountId, data] of accountMap) {
      const opening = openingMap.get(accountId) || 0;
      const closing = opening + data.dr - data.cr;
      const isAsset = data.type === 'asset';
      const isExpense = data.type === 'expense';
      const normalBalance = (isAsset || isExpense) ? 'debit' as const : 'credit' as const;
      const displayValue = (normalBalance === 'debit') ? closing : -closing;

      balances.push({
        account_id: accountId, gl_code: data.gl, account_name: data.name,
        account_type: data.type as any, opening_balance: opening,
        period_debits: data.dr, period_credits: data.cr,
        closing_balance: closing, normal_balance: normalBalance, display_value: displayValue,
      });

      if (data.type === 'asset') totalAssets += closing;
      if (data.type === 'liability') totalLiabilities += -closing;
      if (data.type === 'equity') totalEquity += -closing;
      if (data.type === 'income') totalRevenue += -closing;
      if (data.type === 'expense') totalExpenses += closing;
    }

    // Equity = existing equity + retained earnings + current net income
    const netIncome = totalRevenue - totalExpenses;
    const existingEquity = balances.filter(b => b.account_type === 'equity').reduce((s, b) => s + Math.abs(b.closing_balance), 0);
    const totalEquityFinal = existingEquity + retainedEarnings + netIncome;

    balances.sort((a, b) => a.gl_code.localeCompare(b.gl_code));

    return {
      period_id: periodId,
      period_name: prevClosed?.period_name || 'Current',
      balances,
      total_assets: totalAssets,
      total_liabilities: totalLiabilities,
      total_equity: totalEquityFinal,
      total_revenue: totalRevenue,
      total_expenses: totalExpenses,
      net_income: netIncome,
      retained_earnings: retainedEarnings,
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
