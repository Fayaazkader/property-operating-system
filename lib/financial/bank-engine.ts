// lib/financial/bank-engine.ts
// Bank Engine — Accounts, statements, transactions with running balances, reconciliation

import { supabase } from '@/lib/supabase';
import { publish } from '../platform/events/event-bus';
import { runReconciliationEngine } from '../../banking/reconciliation-engine';
import type { BankAccount, BankStatement, BankTransaction, BankReconciliationResult } from './types';

export class BankEngine {
  async importStatement(accountId: string, statementDate: string, openingBalance: number, closingBalance: number, transactions: Array<{ date: string; description: string; reference?: string; amount: number; type: string }>): Promise<BankStatement> {
    const { data: account } = await supabase.from('bank_accounts').select('entity_id, current_balance').eq('id', accountId).single();
    if (!account) throw new Error('Bank account not found');

    // Validate opening balance against previous closing
    const { data: prevStatement } = await supabase.from('bank_statements').select('closing_balance').eq('bank_account_id', accountId).order('statement_date', { ascending: false }).limit(1).single();
    if (prevStatement && Math.abs(prevStatement.closing_balance - openingBalance) > 0.01) {
      await publish('financial.integrity.breach', {
        correlationId: crypto.randomUUID(), source: 'bank-engine', version: '1.0',
        payload: { type: 'opening_balance_mismatch', accountId, expected: prevStatement.closing_balance, actual: openingBalance, difference: openingBalance - prevStatement.closing_balance },
      });
    }

    const { data: statement, error } = await supabase.from('bank_statements').insert({
      bank_account_id: accountId, entity_id: account.entity_id,
      statement_date: statementDate, opening_balance: openingBalance,
      closing_balance: closingBalance, status: 'imported',
    }).select('*').single();

    if (error) throw error;

    let runningBalance = openingBalance;
    for (const txn of transactions) {
      runningBalance += txn.type === 'credit' ? txn.amount : -txn.amount;

      await supabase.from('bank_transactions').insert({
        bank_account_id: accountId, statement_id: statement.id,
        entity_id: account.entity_id, transaction_date: txn.date,
        description: txn.description, reference: txn.reference,
        amount: txn.amount, type: txn.type,
        statement_running_balance: Math.round(runningBalance * 100) / 100,
      });
    }

    await supabase.from('bank_accounts').update({ current_balance: closingBalance, updated_at: new Date().toISOString() }).eq('id', accountId);

    await runReconciliationEngine(account.entity_id);

    await publish('bank.statement.imported', {
      correlationId: crypto.randomUUID(), source: 'bank-engine', version: '1.0',
      payload: { statementId: statement.id, accountId, transactionCount: transactions.length },
    });

    return statement as BankStatement;
  }

  async reconcileTransaction(transactionId: string, matchType: string, matchId: string, journalId?: string): Promise<void> {
    await supabase.from('bank_transactions').update({
      is_reconciled: true,
      matched_invoice_id: matchType === 'invoice' ? matchId : null,
      matched_payment_id: matchType === 'payment' ? matchId : null,
      matched_journal_id: journalId || null,
    }).eq('id', transactionId);

    await publish('bank.transaction.reconciled', {
      correlationId: crypto.randomUUID(), source: 'bank-engine', version: '1.0',
      payload: { transactionId, matchType, matchId, journalId },
    });
  }

  async getUnreconciled(entityId: string): Promise<BankTransaction[]> {
    const { data } = await supabase.from('bank_transactions').select('*').eq('entity_id', entityId).eq('is_reconciled', false).order('transaction_date', { ascending: false });
    return (data || []) as BankTransaction[];
  }

  async getReconciliationStats(entityId: string): Promise<{ total: number; reconciled: number; percentage: number }> {
    const { count: total } = await supabase.from('bank_transactions').select('*', { count: 'exact', head: true }).eq('entity_id', entityId);
    const { count: reconciled } = await supabase.from('bank_transactions').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).eq('is_reconciled', true);
    return {
      total: total || 0, reconciled: reconciled || 0,
      percentage: total ? Math.round(((reconciled || 0) / total) * 100) : 100,
    };
  }

  async suggestMatches(transactionId: string): Promise<BankReconciliationResult[]> {
    const { data: txn } = await supabase.from('bank_transactions').select('*').eq('id', transactionId).single();
    if (!txn) return [];

    const results: BankReconciliationResult[] = [];
    const { data: lines } = await supabase.from('journal_lines').select('*, journals!inner(entity_id)').eq('journals.entity_id', txn.entity_id).or(`debit_amount.eq.${txn.amount},credit_amount.eq.${txn.amount}`).limit(5);

    for (const line of (lines || [])) {
      results.push({
        transaction: txn as BankTransaction,
        matched: true, matched_type: 'journal_line', matched_id: line.id,
        confidence: 85,
        suggestion: `Match to ${line.description || 'journal line'} for R${(line.debit_amount || line.credit_amount).toLocaleString()}`,
      });
    }

    return results;
  }

  async getAccounts(entityId: string): Promise<BankAccount[]> {
    const { data } = await supabase.from('bank_accounts').select('*').eq('entity_id', entityId).eq('is_active', true);
    return (data || []) as BankAccount[];
  }

  async getTransactionDrillDown(transactionId: string): Promise<any> {
    const { data: txn } = await supabase.from('bank_transactions').select('*').eq('id', transactionId).single();
    if (!txn) return null;

    const drill: any = { transaction: txn };

    if (txn.matched_journal_id) {
      const { data: journal } = await supabase.from('journals').select('*, lines:journal_lines(*)').eq('id', txn.matched_journal_id).single();
      drill.journal = journal;
    }

    const { data: timeline } = await supabase.from('financial_timeline').select('*').eq('reference_type', 'bank_transaction').eq('reference_id', transactionId).order('created_at');
    drill.timeline = timeline || [];

    return drill;
  }
}

export const bankEngine = new BankEngine();
