// lib/financial/statements-engine.ts
// Financial Statements Engine — IS, BS, CF as locked period snapshots

import { supabase } from '@/lib/supabase';
import { publish } from '../platform/events/event-bus';
import type { IncomeStatement, BalanceSheet, CashFlowStatement, TrialBalanceLine, DrillDownResult, FinancialStatement } from './types';

export class FinancialStatementsEngine {
  async generateTrialBalance(entityId: string, periodId: string): Promise<TrialBalanceLine[]> {
    const { data: lines } = await supabase
      .from('general_ledger')
      .select('account_id, debit_amount, credit_amount, chart_of_accounts!inner(account_name, gl_code, account_type)')
      .eq('entity_id', entityId)
      .eq('period_id', periodId);

    const accountMap = new Map<string, { account_name: string; gl_code: string; account_type: string; total_debits: number; total_credits: number }>();

    for (const line of (lines || [])) {
      const acc = line.chart_of_accounts as any;
      if (!acc) continue;
      const key = line.account_id;
      if (!accountMap.has(key)) {
        accountMap.set(key, { account_name: acc.account_name, gl_code: acc.gl_code, account_type: acc.account_type, total_debits: 0, total_credits: 0 });
      }
      const entry = accountMap.get(key)!;
      entry.total_debits += line.debit_amount || 0;
      entry.total_credits += line.credit_amount || 0;
    }

    const result: TrialBalanceLine[] = [];
    for (const [account_id, data] of accountMap) {
      result.push({
        account_id, account_name: data.account_name, gl_code: data.gl_code,
        account_type: data.account_type, total_debits: data.total_debits,
        total_credits: data.total_credits,
        net_balance: data.total_debits - data.total_credits,
      });
    }

    return result.sort((a, b) => a.gl_code.localeCompare(b.gl_code));
  }

  async generateIncomeStatement(entityId: string, periodId: string): Promise<IncomeStatement> {
    const tb = await this.generateTrialBalance(entityId, periodId);
    const revenue = tb.filter(l => l.account_type === 'income').map(l => ({ account: `${l.gl_code} - ${l.account_name}`, amount: l.net_balance }));
    const expenses = tb.filter(l => l.account_type === 'expense').map(l => ({ account: `${l.gl_code} - ${l.account_name}`, amount: Math.abs(l.net_balance) }));
    const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

    const statement: IncomeStatement = { revenue, expenses, total_revenue: totalRevenue, total_expenses: totalExpenses, net_income: totalRevenue - totalExpenses };

    await supabase.from('financial_statements').upsert({
      entity_id: entityId, period_id: periodId, statement_type: 'income_statement',
      statement_data: statement as any, generated_at: new Date().toISOString(),
    }, { onConflict: 'entity_id,period_id,statement_type' });

    return statement;
  }

  async generateBalanceSheet(entityId: string, periodId: string): Promise<BalanceSheet> {
    const tb = await this.generateTrialBalance(entityId, periodId);
    const assets = tb.filter(l => l.account_type === 'asset').map(l => ({ account: `${l.gl_code} - ${l.account_name}`, amount: l.net_balance }));
    const liabilities = tb.filter(l => l.account_type === 'liability').map(l => ({ account: `${l.gl_code} - ${l.account_name}`, amount: Math.abs(l.net_balance) }));
    const equityAccounts = tb.filter(l => l.account_type === 'equity');
    const totalAssets = assets.reduce((s, a) => s + a.amount, 0);
    const totalLiabilities = liabilities.reduce((s, l) => s + l.amount, 0);

    // Include net income in equity
    const is = await this.generateIncomeStatement(entityId, periodId);
    const equity = [
      ...equityAccounts.map(l => ({ account: `${l.gl_code} - ${l.account_name}`, amount: Math.abs(l.net_balance) })),
      { account: 'Current Year Earnings', amount: is.net_income },
    ];
    const totalEquity = equity.reduce((s, e) => s + e.amount, 0);

    const statement: BalanceSheet = {
      assets, liabilities, equity,
      total_assets: totalAssets, total_liabilities: totalLiabilities, total_equity: totalEquity,
      balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
    };

    await supabase.from('financial_statements').upsert({
      entity_id: entityId, period_id: periodId, statement_type: 'balance_sheet',
      statement_data: statement as any, generated_at: new Date().toISOString(),
    }, { onConflict: 'entity_id,period_id,statement_type' });

    return statement;
  }

  async generateCashFlow(entityId: string, periodId: string): Promise<CashFlowStatement> {
    // Get all bank account GL entries for the period
    const { data: bankAccounts } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('entity_id', entityId)
      .eq('account_type', 'asset')
      .ilike('account_name', '%bank%');

    if (!bankAccounts?.length) {
      return { operating: [], investing: [], financing: [], net_cash_flow: 0, opening_cash: 0, closing_cash: 0 };
    }

    const bankIds = bankAccounts.map(b => b.id);

    // Get journal lines for bank accounts, classified by posting template
    const { data: lines } = await supabase
      .from('journal_lines')
      .select('debit_amount, credit_amount, description, journals!inner(source_event, period_id)')
      .in('account_id', bankIds)
      .eq('journals.period_id', periodId);

    // Classify cash flows by source_event (not free text)
    const operating: Array<{ description: string; amount: number }> = [];
    const investing: Array<{ description: string; amount: number }> = [];
    const financing: Array<{ description: string; amount: number }> = [];

    for (const line of (lines || [])) {
      const event = (line.journals as any)?.source_event || '';
      const amount = (line.debit_amount || 0) - (line.credit_amount || 0);

      if (event.includes('rental') || event.includes('receipt') || event.includes('recovery') || event.includes('supplier') || event.includes('bank_charge') || event.includes('interest') || event.includes('commission')) {
        operating.push({ description: line.description || event, amount });
      } else if (event.includes('asset') || event.includes('deposit')) {
        investing.push({ description: line.description || event, amount });
      } else {
        financing.push({ description: line.description || event, amount });
      }
    }

    const netCashFlow = (lines || []).reduce((s, l) => s + (l.debit_amount || 0) - (l.credit_amount || 0), 0);

    // Opening cash from previous period
    let openingCash = 0;
    const { data: prevPeriod } = await supabase.from('financial_periods').select('id').eq('entity_id', entityId).eq('period_type', 'financial').eq('status', 'closed').lt('end_date', new Date().toISOString()).order('end_date', { ascending: false }).limit(1).single();

    if (prevPeriod) {
      const { data: prevLines } = await supabase.from('journal_lines').select('debit_amount, credit_amount').in('account_id', bankIds).eq('journals.period_id', prevPeriod.id);
      openingCash = (prevLines || []).reduce((s, l) => s + (l.debit_amount || 0) - (l.credit_amount || 0), 0);
    }

    const statement: CashFlowStatement = {
      operating, investing, financing,
      net_cash_flow: netCashFlow, opening_cash: openingCash, closing_cash: openingCash + netCashFlow,
    };

    await supabase.from('financial_statements').upsert({
      entity_id: entityId, period_id: periodId, statement_type: 'cash_flow',
      statement_data: statement as any, generated_at: new Date().toISOString(),
    }, { onConflict: 'entity_id,period_id,statement_type' });

    return statement;
  }

  async lockStatement(entityId: string, periodId: string, statementType: string): Promise<void> {
    await supabase.from('financial_statements').update({ is_locked: true }).eq('entity_id', entityId).eq('period_id', periodId).eq('statement_type', statementType);

    await publish('financial.statement.locked', {
      correlationId: crypto.randomUUID(), source: 'statements-engine', version: '1.0',
      payload: { entityId, periodId, statementType },
    });
  }

  async getStatement(entityId: string, periodId: string, statementType: string): Promise<FinancialStatement | null> {
    const { data } = await supabase.from('financial_statements').select('*').eq('entity_id', entityId).eq('period_id', periodId).eq('statement_type', statementType).single();
    return (data || null) as FinancialStatement | null;
  }

  async drillDown(entityId: string, targetType: string, targetId: string): Promise<DrillDownResult> {
    const result: DrillDownResult = { target_type: targetType, target_id: targetId, timeline: [], documents: [] };

    if (targetType === 'journal') {
      const { data: journal } = await supabase.from('journals').select('*, lines:journal_lines(*)').eq('id', targetId).single();
      result.journal = journal as any;
    }

    if (targetType === 'bank_transaction') {
      const { data: txn } = await supabase.from('bank_transactions').select('*').eq('id', targetId).single();
      result.transaction = txn as any;
      if ((txn as any)?.matched_journal_id) {
        const { data: journal } = await supabase.from('journals').select('*').eq('id', (txn as any).matched_journal_id).single();
        result.journal = journal as any;
      }
    }

    const { data: timeline } = await supabase.from('financial_timeline').select('*').eq('entity_id', entityId).eq('reference_id', targetId).order('created_at');
    result.timeline = (timeline || []) as any;

    const { data: docs } = await supabase.from('documents').select('*').eq('entity_id', entityId).or(`related_entity_id.eq.${targetId},source_id.eq.${targetId}`).order('created_at', { ascending: false });
    result.documents = (docs || []) as any;

    return result;
  }

  async generateAllStatements(entityId: string, periodId: string): Promise<{ incomeStatement: IncomeStatement; balanceSheet: BalanceSheet; cashFlow: CashFlowStatement }> {
    const [incomeStatement, balanceSheet, cashFlow] = await Promise.all([
      this.generateIncomeStatement(entityId, periodId),
      this.generateBalanceSheet(entityId, periodId),
      this.generateCashFlow(entityId, periodId),
    ]);

    await publish('financial.statements.generated', {
      correlationId: crypto.randomUUID(), source: 'statements-engine', version: '1.0',
      payload: { entityId, periodId },
    });

    return { incomeStatement, balanceSheet, cashFlow };
  }
}

export const financialStatementsEngine = new FinancialStatementsEngine();
