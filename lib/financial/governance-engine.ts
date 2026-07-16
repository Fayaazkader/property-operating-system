// lib/financial/governance-engine.ts
// Financial Governance Engine — Validation, integrity, close checklist

import { supabase } from '@/lib/supabase';
import { publish } from '../platform/events/event-bus';
import type { FinancialEvent, IntegrityLogEntry, CloseChecklistItem, FinancialIntegrityScore } from './types';

export class FinancialGovernanceEngine {
  async validateEvent(event: FinancialEvent): Promise<{ valid: boolean; reason?: string }> {
    if (!event.entity_id) return { valid: false, reason: 'Entity ID is required' };
    if (!event.amount || event.amount <= 0) return { valid: false, reason: 'Amount must be greater than zero' };
    if (!event.business_event) return { valid: false, reason: 'Business event is required' };
    if (!event.source_engine) return { valid: false, reason: 'Source engine is required' };

    const periodId = event.period_id || await this.getCurrentPeriodId(event.entity_id);
    if (!periodId) return { valid: false, reason: 'No open financial period found' };

    const { data: period } = await supabase.from('financial_periods').select('status').eq('id', periodId).single();
    if (period?.status === 'closed') return { valid: false, reason: 'Financial period is closed' };
    if (period?.status === 'pending_review') return { valid: false, reason: 'Period is pending review' };

    if (event.metadata?.source_id) {
      const { data: existing } = await supabase.from('journals').select('id').eq('source_id', event.metadata.source_id).eq('source_event', event.business_event).single();
      if (existing) return { valid: false, reason: 'Duplicate journal exists for this source event' };
    }

    return { valid: true };
  }

  async runIntegrityChecks(entityId: string, periodId: string): Promise<IntegrityLogEntry[]> {
    const checks: IntegrityLogEntry[] = [];
    let totalDr = 0, totalCr = 0;

    const { data: journals } = await supabase.from('journals').select('id').eq('entity_id', entityId).eq('period_id', periodId).eq('is_posted', true);
    for (const j of (journals || [])) {
      const { data: lines } = await supabase.from('journal_lines').select('debit_amount, credit_amount').eq('journal_id', j.id);
      for (const l of (lines || [])) { totalDr += l.debit_amount; totalCr += l.credit_amount; }
    }

    const balanced = Math.abs(totalDr - totalCr) < 0.01;
    checks.push({
      id: crypto.randomUUID(), entity_id: entityId, period_id: periodId,
      check_type: 'trial_balance',
      level: balanced ? 'info' : 'critical',
      message: balanced ? 'Trial Balance balances' : `Trial Balance out of balance: Dr ${totalDr.toFixed(2)}, Cr ${totalCr.toFixed(2)}`,
      acknowledged: balanced,
    });

    const { data: unposted } = await supabase.from('journals').select('id').eq('entity_id', entityId).eq('period_id', periodId).eq('is_posted', false);
    checks.push({
      id: crypto.randomUUID(), entity_id: entityId, period_id: periodId,
      check_type: 'unposted_journals',
      level: (unposted?.length || 0) > 0 ? 'warning' : 'info',
      message: (unposted?.length || 0) > 0 ? `${unposted!.length} unposted journal(s) found` : 'All journals posted',
      acknowledged: (unposted?.length || 0) === 0,
    });

    for (const check of checks) {
      await supabase.from('financial_integrity_log').insert(check);
    }

    return checks;
  }

  async getIntegrityScore(entityId: string, periodId: string): Promise<FinancialIntegrityScore> {
    const checks = await this.runIntegrityChecks(entityId, periodId);
    const passed = checks.filter(c => c.acknowledged).length;
    const score = passed;
    const maxScore = checks.length;

    return {
      score, max_score: maxScore,
      percentage: maxScore > 0 ? Math.round((score / maxScore) * 100) : 100,
      checks: checks.map(c => ({ name: c.check_type, passed: c.acknowledged, message: c.message })),
    };
  }

  async getCloseChecklist(entityId: string, periodId: string): Promise<CloseChecklistItem[]> {
    const items = [
      'Billing Run Completed', 'Statements Generated', 'Deposits Reviewed',
      'Bank Accounts Reconciled', 'Supplier Invoices Captured', 'Receipts Allocated',
      'Payments Reconciled', 'Arrears Reviewed', 'Broker Commissions Reviewed',
      'VAT Reviewed', 'Outstanding Approvals Reviewed', 'Exceptions Acknowledged',
      'Trial Balance Verified',
    ];

    for (const item of items) {
      await supabase.from('financial_close_checklist').insert({
        id: crypto.randomUUID(), entity_id: entityId, period_id: periodId,
        checklist_item: item, category: 'close', status: 'pending',
      }).select('id').single();
    }

    const { data } = await supabase.from('financial_close_checklist').select('*').eq('entity_id', entityId).eq('period_id', periodId);
    return (data || []) as CloseChecklistItem[];
  }

  async canClosePeriod(entityId: string, periodId: string): Promise<{ canClose: boolean; criticalCount: number; warningCount: number }> {
    const checks = await this.runIntegrityChecks(entityId, periodId);
    const criticalCount = checks.filter(c => c.level === 'critical' && !c.acknowledged).length;
    const warningCount = checks.filter(c => c.level === 'warning' && !c.acknowledged).length;
    return { canClose: criticalCount === 0, criticalCount, warningCount };
  }

  async closePeriod(periodId: string, userId: string): Promise<void> {
    await supabase.from('financial_periods').update({
      status: 'closed', closed_at: new Date().toISOString(), closed_by: userId,
    }).eq('id', periodId);

    await publish('financial.period.closed', {
      correlationId: crypto.randomUUID(), source: 'governance-engine', version: '1.0',
      payload: { periodId, closedBy: userId },
    });
  }

  private async getCurrentPeriodId(entityId: string): Promise<string | null> {
    const { data } = await supabase.from('financial_periods').select('id').eq('entity_id', entityId).eq('period_type', 'financial').eq('status', 'open').order('start_date').limit(1).single();
    return data?.id || null;
  }
}

export const financialGovernanceEngine = new FinancialGovernanceEngine();
