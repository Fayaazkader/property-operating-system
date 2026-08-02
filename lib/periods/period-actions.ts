// lib/periods/period-actions.ts
// Period Governance — Production hardened. All critical transitions use atomic RPCs.

import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit/audit-log';
import { financialTimelineEngine } from '@/lib/financial/timeline-engine';
import { billingStatusService } from '@/lib/revenue/billing-status-service';
import { reconciliationStatusService } from '@/lib/cashbook/reconciliation-status-service';
import { tbStatusService } from '@/lib/financial/tb-status-service';
import { withIdempotency } from './idempotency';
import { withOptimisticLock } from './concurrency';
import { publishWithRetry } from './event-delivery';

export interface ValidationResult { check: string; passed: boolean; message: string; }
export interface PeriodActionResult { success: boolean; nextPeriod: string; message: string; validations: ValidationResult[]; newPhase?: string; idempotent?: boolean; concurrencyConflict?: boolean; }

export async function startBillingRun(entityId: string, statementPeriod: string, correlationId?: string): Promise<PeriodActionResult> {
  const cid = correlationId || crypto.randomUUID();
  return withIdempotency(cid, 'start_billing_run', async () => {
    return withOptimisticLock(entityId, 'statement', statementPeriod, 'open', 'billing_requested', async () => {
      const billingStatus = await billingStatusService.getStatus(entityId);
      if (billingStatus.activeLeases === 0) return { success: false, message: 'No active leases' };
      await publishWithRetry('period.billing_run.requested', { correlationId: cid, source: 'period-governance', version: '1.0', payload: { entityId, statementPeriod } });
      await financialTimelineEngine.addEntry({ entity_id: entityId, reference_type: 'statement_period', reference_id: statementPeriod, event_type: 'billing_run_requested', description: `Billing requested`, source_engine: 'period-governance', correlation_id: cid });
      await logAudit({ action: 'create', resource_type: 'billing_run', resource_label: `Billing requested for ${statementPeriod}`, new_values: { entityId, statementPeriod } });
      return { success: true, nextPeriod: statementPeriod, message: 'Billing requested', newPhase: 'billing_requested' };
    });
  });
}

export async function closeStatementPeriod(entityId: string, periodName: string, correlationId?: string): Promise<PeriodActionResult> {
  const cid = correlationId || crypto.randomUUID();
  return withIdempotency(cid, 'close_statement_period', async () => {
    const [billingStatus, reconciliationStatus, tbStatus] = await Promise.all([
      billingStatusService.getStatus(entityId), reconciliationStatusService.getStatus(entityId), tbStatusService.getStatus(entityId),
    ]);
    if (!billingStatus.completed || !reconciliationStatus.balanced || !tbStatus.balanced) {
      return { success: false, message: 'Close validations failed', validations: [
        { check: 'invoices', passed: billingStatus.completed, message: `${billingStatus.invoicesGenerated} invoices` },
        { check: 'cashbook', passed: reconciliationStatus.balanced, message: reconciliationStatus.balanced ? 'Reconciled' : `${reconciliationStatus.unreconciled} unreconciled` },
        { check: 'tb', passed: tbStatus.balanced, message: tbStatus.balanced ? 'TB balanced' : 'TB out of balance' },
      ]};
    }
    const { data, error } = await supabase.rpc('close_statement_period_atomic', { p_entity_id: entityId, p_period_name: periodName, p_expected_phase: 'billing_complete' });
    if (error) return { success: false, message: error.message };
    const result = data as any;
    if (!result.success) return result;
    await financialTimelineEngine.addEntry({ entity_id: entityId, reference_type: 'statement_period', reference_id: periodName, event_type: 'statement_closed', description: `Statement ${periodName} closed`, source_engine: 'period-governance', correlation_id: cid });
    await publishWithRetry('period.statement.closed', { correlationId: cid, source: 'period-governance', version: '1.0', payload: { entityId, periodName, nextPeriod: result.nextPeriod } });
    await logAudit({ action: 'update', resource_type: 'statement_period', resource_label: `Statement ${periodName} closed`, old_values: { status: 'open' }, new_values: { status: 'closed', nextPeriod: result.nextPeriod } });
    return { success: true, nextPeriod: result.nextPeriod, message: 'Statement closed', newPhase: 'closed' };
  });
}

export async function closeFinancialPeriod(entityId: string, periodName: string, correlationId?: string): Promise<PeriodActionResult> {
  const cid = correlationId || crypto.randomUUID();
  return withIdempotency(cid, 'close_financial_period', async () => {
    const [reconciliationStatus, tbStatus] = await Promise.all([reconciliationStatusService.getStatus(entityId), tbStatusService.getStatus(entityId)]);
    // Only check statements that end before this financial period
    const { data: finPeriod } = await supabase.from('financial_periods').select('period_end').eq('entity_id', entityId).eq('period_type', 'financial').eq('period_name', periodName).single();
    const { data: openStatements } = finPeriod ? await supabase.from('financial_periods').select('id').eq('entity_id', entityId).eq('period_type', 'statement').neq('status', 'closed').lt('period_end', finPeriod.period_end) : { data: [] };
    if ((openStatements?.length || 0) > 0 || !tbStatus.balanced || !reconciliationStatus.balanced) {
      return { success: false, message: 'Close validations failed' };
    }
    // RPC handles concurrency and atomicity
    const { data, error } = await supabase.rpc('close_financial_period_atomic', { p_entity_id: entityId, p_period_name: periodName, p_expected_phase: 'open' });
    if (error) return { success: false, message: error.message };
    const result = data as any;
    if (!result.success) return result;
    await financialTimelineEngine.addEntry({ entity_id: entityId, reference_type: 'financial_period', reference_id: periodName, event_type: 'financial_closed', description: `Financial ${periodName} closed`, source_engine: 'period-governance', correlation_id: cid });
    await publishWithRetry('period.financial.closed', { correlationId: cid, source: 'period-governance', version: '1.0', payload: { entityId, periodName, nextPeriod: result.nextPeriod } });
    await logAudit({ action: 'update', resource_type: 'financial_period', resource_label: `Financial ${periodName} closed`, old_values: { status: 'open' }, new_values: { status: 'closed', nextPeriod: result.nextPeriod } });
    return { success: true, nextPeriod: result.nextPeriod, message: 'Financial closed', newPhase: 'closed' };
  });
}
