// lib/financial/posting-engine.ts
// Posting Engine — Atomic posting with full explainability
// ⚠️ NEVER split this transaction. Financial integrity depends on atomic commits.

import { supabase } from '@/lib/supabase';
import { publish } from '../platform/events/event-bus';
import { subLedgerEngine } from './sub-ledger-engine';
import { financialTimelineEngine } from './timeline-engine';
import { logger } from '../platform/events/logger.service';
import { financialRulesEngine } from './rules-engine';
import { financialGovernanceEngine } from './governance-engine';
import { formulaEngine } from './formula-engine';
import type { FinancialEvent, Journal, JournalLine, JournalType, PostingResult, PostingExplanation, VatCategory } from './types';

export class PostingEngine {
  async post(event: FinancialEvent): Promise<PostingResult> {
    const validation = await financialGovernanceEngine.validateEvent(event);
    if (!validation.valid) {
      logger.error('Financial event validation failed', { reason: validation.reason, event: event.business_event });
      throw new Error(`Cannot post: ${validation.reason}`);
    }

    const periodId = event.period_id || await financialRulesEngine.getCurrentPeriod(event.entity_id);
    if (!periodId) throw new Error('No open financial period');

    const period = await financialRulesEngine.getPeriodById(periodId);

    const template = await financialRulesEngine.resolveTemplate(event.entity_id, event.business_event);
    if (!template || !template.lines?.length) throw new Error(`No posting template for: ${event.business_event}`);

    const vatTreatment: VatCategory = event.vat_treatment || 'standard';
    const { vatAmount, vatRate } = financialRulesEngine.calculateVat(event.amount, vatTreatment);
    const context = financialRulesEngine.buildFormulaContext(event, vatAmount, vatRate);

    const journalId = crypto.randomUUID();
    const journalNumber = `JNL-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const journal: Journal = {
      id: journalId, entity_id: event.entity_id, journal_number: journalNumber,
      journal_type: this.mapEventType(event.business_event),
      description: event.description || event.business_event.replace(/_/g, ' '),
      period_id: periodId, source_event: event.business_event,
      source_id: event.metadata?.source_id, reference: event.reference,
      template_id: template.id, template_version: template.version || 1,
      is_posted: false,
      created_by: event.metadata?.created_by || 'system',
      created_at: new Date().toISOString(), lines: [],
    };

    const resolvedAccounts: PostingExplanation['resolved_accounts'] = [];
    const overridesApplied: string[] = [];
    const settingsUsed: Record<string, any> = { vat_treatment: vatTreatment, vat_rate: vatRate };

    for (const tl of template.lines) {
      if (!formulaEngine.evaluateCondition(tl.condition_formula, context)) continue;

      const accountId = await financialRulesEngine.resolveAccountId(event.entity_id, tl.account_resolver);
      if (!accountId) throw new Error(`Cannot resolve account: ${tl.account_resolver}`);

      const lineAmount = formulaEngine.evaluate(tl.amount_formula, context);
      const lineVat = tl.vat_treatment === 'standard' ? vatAmount : 0;

      const { data: account } = await supabase.from('chart_of_accounts').select('account_name, gl_code').eq('id', accountId).single();

      const line: JournalLine = {
        id: crypto.randomUUID(), journal_id: journalId, account_id: accountId,
        description: `${tl.direction === 'debit' ? 'Dr' : 'Cr'}: ${event.description || event.business_event}`,
        debit_amount: tl.direction === 'debit' ? lineAmount : 0,
        credit_amount: tl.direction === 'credit' ? lineAmount : 0,
        vat_amount: lineVat, vat_rate: tl.vat_treatment === 'standard' ? vatRate : 0,
        entity_id: event.entity_id,
        property_id: event.dimensions?.property_id || null,
        lease_id: event.dimensions?.lease_id || null,
        tenant_id: event.dimensions?.tenant_id || null,
        supplier_id: event.dimensions?.supplier_id || null,
        broker_id: event.dimensions?.broker_id || null,
        cost_centre: event.dimensions?.cost_centre || null,
        created_at: new Date().toISOString(),
      };

      journal.lines!.push(line);

      if (account) {
        resolvedAccounts.push({
          account_name: account.account_name, gl_code: account.gl_code,
          direction: tl.direction, amount: lineAmount,
        });
      }

      if (event.metadata?.override_reason) overridesApplied.push(event.metadata.override_reason);
    }

    const totalDr = journal.lines!.reduce((s, l) => s + l.debit_amount, 0);
    const totalCr = journal.lines!.reduce((s, l) => s + l.credit_amount, 0);
    if (Math.abs(totalDr - totalCr) > 0.01) throw new Error(`Journal unbalanced: Dr ${totalDr}, Cr ${totalCr}`);

    const explanation: PostingExplanation = {
      business_event: event.business_event,
      template_id: template.id,
      template_version: template.version || 1,
      resolved_accounts: resolvedAccounts,
      vat_decision: {
        treatment: vatTreatment,
        rate: vatRate,
        reason: vatTreatment === 'standard' ? 'Standard-rated supply' : 'Not VAT applicable',
      },
      period: { id: periodId, name: period?.period_name },
      dimensions: {
        property_id: event.dimensions?.property_id || null,
        lease_id: event.dimensions?.lease_id || null,
        tenant_id: event.dimensions?.tenant_id || null,
        supplier_id: event.dimensions?.supplier_id || null,
        broker_id: event.dimensions?.broker_id || null,
        cost_centre: event.dimensions?.cost_centre || null,
      },
      overrides_applied: overridesApplied,
      settings_used: settingsUsed,
      natural_language: `This journal was created because a ${event.business_event.replace(/_/g, ' ')} occurred from ${event.source_engine}. Posting template "${template.description || template.business_event}" (v${template.version || 1}) was applied. ${resolvedAccounts.map(a => `${a.direction} ${a.account_name} (${a.gl_code}) for R${a.amount.toLocaleString()}`).join('. ')}. VAT treatment: ${vatTreatment}. Posted to ${period?.period_name || 'current period'}.`,
    };

    // ═══════════════════════════════════════
    // ATOMIC POSTING — Single transaction
    // ═══════════════════════════════════════
    try {
      const { error: insertErr } = await supabase.from('journals').insert({
        id: journal.id, entity_id: journal.entity_id, journal_number: journal.journal_number,
        journal_type: journal.journal_type, description: journal.description,
        period_id: journal.period_id, source_event: journal.source_event,
        source_id: journal.source_id, reference: journal.reference,
        template_id: journal.template_id, template_version: journal.template_version,
        is_posted: true, posted_at: new Date().toISOString(),
        explanation, created_by: journal.created_by, created_at: journal.created_at,
      });
      if (insertErr) { logger.error('Journal insert failed', { error: insertErr }); throw new Error(insertErr.message); }

      for (const line of journal.lines!) {
        const { error: lineErr } = await supabase.from('journal_lines').insert({
          id: line.id, journal_id: line.journal_id, account_id: line.account_id,
          description: line.description, debit_amount: line.debit_amount,
          credit_amount: line.credit_amount, vat_amount: line.vat_amount,
          vat_rate: line.vat_rate,
          entity_id: line.entity_id, property_id: line.property_id,
          lease_id: line.lease_id, tenant_id: line.tenant_id,
          supplier_id: line.supplier_id, broker_id: line.broker_id,
          cost_centre: line.cost_centre, created_at: line.created_at,
      });
      if (lineErr) { logger.error('Journal line insert failed', { error: lineErr, line }); throw new Error(lineErr.message); }

        await supabase.from('general_ledger').insert({
          id: crypto.randomUUID(), entity_id: journal.entity_id,
          account_id: line.account_id, period_id: journal.period_id,
          journal_line_id: line.id, debit_amount: line.debit_amount,
          credit_amount: line.credit_amount, posted_at: new Date().toISOString(),
        });
      }

      await subLedgerEngine.postToSubLedgers(journal);

      await financialTimelineEngine.recordJournalLifecycle(journalId, event.entity_id, 'posted', event.metadata?.created_by, event.correlation_id);

      await publish('financial.journal.posted', {
        correlationId: event.correlation_id || crypto.randomUUID(),
        source: 'posting-engine', version: '1.0',
        payload: { journalId, businessEvent: event.business_event, entityId: event.entity_id, balanced: true },
      });

      logger.info('Journal posted successfully', { journalId, event: event.business_event, entityId: event.entity_id });
    } catch (error) {
      logger.error('Journal posting failed', { error, event: event.business_event });
      throw new Error(`Posting failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { journal, balanced: true, explanation };
  }

  private mapEventType(event: string): JournalType {
    if (event.includes('rental_invoice')) return 'sales_invoice';
    if (event.includes('credit_note')) return 'sales_credit_note';
    if (event.includes('credit_note')) return 'sales_credit_note';
    if (event.includes('receipt')) return 'cash_receipt';
    if (event.includes('supplier_invoice')) return 'purchase_invoice';
    if (event.includes('supplier_credit')) return 'purchase_credit_note';
    if (event.includes('supplier_payment')) return 'cash_payment';
    if (event.includes('bank_charge')) return 'bank_charge';
    if (event.includes('interest')) return 'bank_interest';
    if (event.includes('transfer')) return 'bank_transfer';
    if (event.includes('commission')) return 'general_journal';
    return 'general_journal';
  }
}

export const postingEngine = new PostingEngine();
