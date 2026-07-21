// lib/periods/period-actions.ts
// Period Governance — Orchestrates domain services. Domain owns workflow state.

import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit/audit-log';
import { publish } from '@/lib/platform/events/event-bus';
import { financialTimelineEngine } from '@/lib/financial/timeline-engine';
import { billingStatusService } from '@/lib/revenue/billing-status-service';
import { reconciliationStatusService } from '@/lib/cashbook/reconciliation-status-service';
import { tbStatusService } from '@/lib/financial/tb-status-service';
import { getNextPeriodWithDates } from './period-utils';

export interface ValidationResult { check: string; passed: boolean; message: string; }

export interface PeriodActionResult {
  success: boolean; nextPeriod: string; message: string; validations: ValidationResult[]; newPhase?: string;
}

async function updateWorkflowPhase(entityId: string, periodType: string, periodName: string, phase: string) {
  await supabase.from('financial_periods').update({ workflow_phase: phase }).eq('entity_id', entityId).eq('period_type', periodType).eq('period_name', periodName);
}

export async function startBillingRun(entityId: string, statementPeriod: string): Promise<PeriodActionResult> {
  const billingStatus = await billingStatusService.getStatus(entityId);
  const validations: ValidationResult[] = [
    { check: 'active_leases', passed: billingStatus.activeLeases > 0, message: `${billingStatus.activeLeases} active leases` },
  ];
  if (!validations.every(v => v.passed)) return { success: false, nextPeriod: '', message: 'Pre-billing checks failed', validations };

  // Period Governance ONLY sets billing_requested. Revenue owns billing_running and billing_complete.
  await updateWorkflowPhase(entityId, 'statement', statementPeriod, 'billing_requested');

  const correlationId = crypto.randomUUID();
  await publish('period.billing_run.requested', { correlationId, source: 'period-governance', version: '1.0', payload: { entityId, statementPeriod } });

  await financialTimelineEngine.addEntry({ entity_id: entityId, reference_type: 'statement_period', reference_id: statementPeriod, event_type: 'billing_run_requested', description: `Billing run requested for ${statementPeriod}`, source_engine: 'period-governance', correlation_id: correlationId });
  await logAudit({ action: 'create', resource_type: 'billing_run', resource_label: `Billing run requested for ${statementPeriod}`, new_values: { entityId, statementPeriod } });

  return { success: true, nextPeriod: statementPeriod, message: `Billing run requested for ${statementPeriod}`, validations, newPhase: 'billing_requested' };
}

export async function closeStatementPeriod(entityId: string, periodName: string): Promise<PeriodActionResult> {
  const [billingStatus, reconciliationStatus, tbStatus] = await Promise.all([
    billingStatusService.getStatus(entityId), reconciliationStatusService.getStatus(entityId), tbStatusService.getStatus(entityId),
  ]);

  const validations: ValidationResult[] = [
    { check: 'invoices_generated', passed: billingStatus.completed, message: `${billingStatus.invoicesGenerated} invoices` },
    { check: 'cashbook_reconciled', passed: reconciliationStatus.balanced, message: reconciliationStatus.balanced ? 'Reconciled' : `${reconciliationStatus.unreconciled} unreconciled` },
    { check: 'trial_balance', passed: tbStatus.balanced, message: tbStatus.balanced ? 'TB balanced' : 'TB out of balance' },
  ];

  if (!validations.every(v => v.passed)) {
    await updateWorkflowPhase(entityId, 'statement', periodName, 'exception_review');
    return { success: false, nextPeriod: '', message: 'Close validations failed', validations, newPhase: 'exception_review' };
  }

  await updateWorkflowPhase(entityId, 'statement', periodName, 'ready_to_close');
  
  const { error } = await supabase.from('financial_periods').update({ status: 'closed', closed_at: new Date().toISOString(), workflow_phase: 'closed' }).eq('entity_id', entityId).eq('period_type', 'statement').eq('period_name', periodName);
  if (error) return { success: false, nextPeriod: '', message: error.message, validations: [] };

  const { nextPeriod, startDate, endDate } = getNextPeriodWithDates(periodName);
  await supabase.from('financial_periods').insert({ entity_id: entityId, period_type: 'statement', period_name: nextPeriod, period_start: startDate, period_end: endDate, status: 'open', workflow_phase: 'open' });

  const correlationId = crypto.randomUUID();
  await financialTimelineEngine.addEntry({ entity_id: entityId, reference_type: 'statement_period', reference_id: periodName, event_type: 'statement_closed', description: `Statement ${periodName} closed. ${nextPeriod} opened.`, source_engine: 'period-governance', correlation_id: correlationId });
  await publish('period.statement.closed', { correlationId, source: 'period-governance', version: '1.0', payload: { entityId, periodName, nextPeriod } });
  await logAudit({ action: 'update', resource_type: 'statement_period', resource_label: `Statement ${periodName} closed`, old_values: { status: 'open' }, new_values: { status: 'closed', nextPeriod } });

  return { success: true, nextPeriod, message: `Statement ${periodName} closed`, validations, newPhase: 'closed' };
}

export async function closeFinancialPeriod(entityId: string, periodName: string): Promise<PeriodActionResult> {
  const [reconciliationStatus, tbStatus] = await Promise.all([reconciliationStatusService.getStatus(entityId), tbStatusService.getStatus(entityId)]);
  const { data: openStatements } = await supabase.from('financial_periods').select('id').eq('entity_id', entityId).eq('period_type', 'statement').neq('status', 'closed');

  const validations: ValidationResult[] = [
    { check: 'statements_closed', passed: (openStatements?.length || 0) === 0, message: openStatements?.length ? `${openStatements.length} open statements` : 'All closed' },
    { check: 'trial_balance', passed: tbStatus.balanced, message: tbStatus.balanced ? 'TB balanced' : 'TB out of balance' },
    { check: 'cashbook_reconciled', passed: reconciliationStatus.balanced, message: reconciliationStatus.balanced ? 'Reconciled' : `${reconciliationStatus.unreconciled} unreconciled` },
  ];

  if (!validations.every(v => v.passed)) return { success: false, nextPeriod: '', message: 'Close validations failed', validations };

  await updateWorkflowPhase(entityId, 'financial', periodName, 'closing');

  const { error } = await supabase.from('financial_periods').update({ status: 'closed', closed_at: new Date().toISOString(), workflow_phase: 'closed' }).eq('entity_id', entityId).eq('period_type', 'financial').eq('period_name', periodName);
  if (error) return { success: false, nextPeriod: '', message: error.message, validations: [] };

  const { nextPeriod, startDate, endDate } = getNextPeriodWithDates(periodName);
  await supabase.from('financial_periods').insert({ entity_id: entityId, period_type: 'financial', period_name: nextPeriod, period_start: startDate, period_end: endDate, status: 'open', workflow_phase: 'open' });

  const correlationId = crypto.randomUUID();
  await financialTimelineEngine.addEntry({ entity_id: entityId, reference_type: 'financial_period', reference_id: periodName, event_type: 'financial_closed', description: `Financial ${periodName} closed. ${nextPeriod} opened.`, source_engine: 'period-governance', correlation_id: correlationId });
  await publish('period.financial.closed', { correlationId, source: 'period-governance', version: '1.0', payload: { entityId, periodName, nextPeriod } });
  await logAudit({ action: 'update', resource_type: 'financial_period', resource_label: `Financial ${periodName} closed`, old_values: { status: 'open' }, new_values: { status: 'closed', nextPeriod } });

  return { success: true, nextPeriod, message: `Financial ${periodName} closed`, validations, newPhase: 'closed' };
}
