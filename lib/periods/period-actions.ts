// lib/periods/period-actions.ts
// Period Governance — Production hardened

import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit/audit-log';
import { financialTimelineEngine } from '@/lib/financial/timeline-engine';
import { billingStatusService } from '@/lib/revenue/billing-status-service';
import { reconciliationStatusService } from '@/lib/cashbook/reconciliation-status-service';
import { tbStatusService } from '@/lib/financial/tb-status-service';
import { withIdempotency } from './idempotency';
import { withOptimisticLock } from './concurrency';
import { publishWithRetry } from './event-delivery';
import { getNextPeriodWithDates } from './period-utils';

export interface ValidationResult { check: string; passed: boolean; message: string; }
export interface PeriodActionResult { success: boolean; nextPeriod: string; message: string; validations: ValidationResult[]; newPhase?: string; idempotent?: boolean; concurrencyConflict?: boolean; }

export async function startBillingRun(entityId: string, statementPeriod: string, correlationId?: string): Promise<PeriodActionResult> {
  const cid = correlationId || crypto.randomUUID();

  return withIdempotency(cid, 'start_billing_run', async () => {
    return withOptimisticLock(entityId, 'statement', statementPeriod, 'open', 'billing_requested', async () => {
      const billingStatus = await billingStatusService.getStatus(entityId);
      const validations: ValidationResult[] = [
        { check: 'active_leases', passed: billingStatus.activeLeases > 0, message: `${billingStatus.activeLeases} active leases` },
      ];
      if (!validations.every(v => v.passed)) {
        // Rollback phase
        await supabase.from('financial_periods').update({ workflow_phase: 'open' }).eq('entity_id', entityId).eq('period_type', 'statement').eq('period_name', statementPeriod);
        return { success: false, nextPeriod: '', message: 'Pre-billing checks failed', validations };
      }

      await publishWithRetry('period.billing_run.requested', { correlationId: cid, source: 'period-governance', version: '1.0', payload: { entityId, statementPeriod } });
      await financialTimelineEngine.addEntry({ entity_id: entityId, reference_type: 'statement_period', reference_id: statementPeriod, event_type: 'billing_run_requested', description: `Billing run requested for ${statementPeriod}`, source_engine: 'period-governance', correlation_id: cid });
      await logAudit({ action: 'create', resource_type: 'billing_run', resource_label: `Billing run requested for ${statementPeriod}`, new_values: { entityId, statementPeriod } });

      return { success: true, nextPeriod: statementPeriod, message: `Billing run requested for ${statementPeriod}`, validations, newPhase: 'billing_requested' };
    });
  });
}

export async function closeStatementPeriod(entityId: string, periodName: string, correlationId?: string): Promise<PeriodActionResult> {
  const cid = correlationId || crypto.randomUUID();

  return withIdempotency(cid, 'close_statement_period', async () => {
    return withOptimisticLock(entityId, 'statement', periodName, 'billing_complete', 'ready_to_close', async () => {
      const [billingStatus, reconciliationStatus, tbStatus] = await Promise.all([
        billingStatusService.getStatus(entityId), reconciliationStatusService.getStatus(entityId), tbStatusService.getStatus(entityId),
      ]);

      const validations: ValidationResult[] = [
        { check: 'invoices_generated', passed: billingStatus.completed, message: `${billingStatus.invoicesGenerated} invoices` },
        { check: 'cashbook_reconciled', passed: reconciliationStatus.balanced, message: reconciliationStatus.balanced ? 'Reconciled' : `${reconciliationStatus.unreconciled} unreconciled` },
        { check: 'trial_balance', passed: tbStatus.balanced, message: tbStatus.balanced ? 'TB balanced' : 'TB out of balance' },
      ];

      if (!validations.every(v => v.passed)) {
        await supabase.from('financial_periods').update({ workflow_phase: 'exception_review' }).eq('entity_id', entityId).eq('period_type', 'statement').eq('period_name', periodName);
        return { success: false, nextPeriod: '', message: 'Close validations failed', validations, newPhase: 'exception_review' };
      }

      const { data, error } = await supabase.rpc('close_statement_period_atomic', { p_entity_id: entityId, p_period_name: periodName });
      if (error) {
        await supabase.from('financial_periods').update({ workflow_phase: 'exception_review' }).eq('entity_id', entityId).eq('period_type', 'statement').eq('period_name', periodName);
        return { success: false, nextPeriod: '', message: error.message, validations: [] };
      }

      const result = data as any;
      await financialTimelineEngine.addEntry({ entity_id: entityId, reference_type: 'statement_period', reference_id: periodName, event_type: 'statement_closed', description: `Statement ${periodName} closed. ${result.nextPeriod} opened.`, source_engine: 'period-governance', correlation_id: cid });
      await publishWithRetry('period.statement.closed', { correlationId: cid, source: 'period-governance', version: '1.0', payload: { entityId, periodName, nextPeriod: result.nextPeriod } });
      await logAudit({ action: 'update', resource_type: 'statement_period', resource_label: `Statement ${periodName} closed`, old_values: { status: 'open' }, new_values: { status: 'closed', nextPeriod: result.nextPeriod } });

      return { success: true, nextPeriod: result.nextPeriod, message: `Statement ${periodName} closed`, validations, newPhase: 'closed' };
    });
  });
}

export async function closeFinancialPeriod(entityId: string, periodName: string, correlationId?: string): Promise<PeriodActionResult> {
  const cid = correlationId || crypto.randomUUID();

  return withIdempotency(cid, 'close_financial_period', async () => {
    return withOptimisticLock(entityId, 'financial', periodName, 'open', 'closing', async () => {
      const [reconciliationStatus, tbStatus] = await Promise.all([reconciliationStatusService.getStatus(entityId), tbStatusService.getStatus(entityId)]);
      const { data: openStatements } = await supabase.from('financial_periods').select('id').eq('entity_id', entityId).eq('period_type', 'statement').neq('status', 'closed');

      const validations: ValidationResult[] = [
        { check: 'statements_closed', passed: (openStatements?.length || 0) === 0, message: openStatements?.length ? `${openStatements.length} open statements` : 'All closed' },
        { check: 'trial_balance', passed: tbStatus.balanced, message: tbStatus.balanced ? 'TB balanced' : 'TB out of balance' },
        { check: 'cashbook_reconciled', passed: reconciliationStatus.balanced, message: reconciliationStatus.balanced ? 'Reconciled' : `${reconciliationStatus.unreconciled} unreconciled` },
      ];
      if (!validations.every(v => v.passed)) return { success: false, nextPeriod: '', message: 'Close validations failed', validations };

      const { error } = await supabase.from('financial_periods').update({ status: 'closed', closed_at: new Date().toISOString(), workflow_phase: 'closed' }).eq('entity_id', entityId).eq('period_type', 'financial').eq('period_name', periodName);
      if (error) return { success: false, nextPeriod: '', message: error.message, validations: [] };

      const { nextPeriod, startDate, endDate } = getNextPeriodWithDates(periodName);
      await supabase.from('financial_periods').insert({ entity_id: entityId, period_type: 'financial', period_name: nextPeriod, period_start: startDate, period_end: endDate, status: 'open', workflow_phase: 'open' });

      await financialTimelineEngine.addEntry({ entity_id: entityId, reference_type: 'financial_period', reference_id: periodName, event_type: 'financial_closed', description: `Financial ${periodName} closed. ${nextPeriod} opened.`, source_engine: 'period-governance', correlation_id: cid });
      await publishWithRetry('period.financial.closed', { correlationId: cid, source: 'period-governance', version: '1.0', payload: { entityId, periodName, nextPeriod } });
      await logAudit({ action: 'update', resource_type: 'financial_period', resource_label: `Financial ${periodName} closed`, old_values: { status: 'open' }, new_values: { status: 'closed', nextPeriod } });

      return { success: true, nextPeriod, message: `Financial ${periodName} closed`, validations, newPhase: 'closed' };
    });
  });
}
