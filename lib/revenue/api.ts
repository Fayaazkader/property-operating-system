// lib/revenue/api.ts
import { supabase } from '@/lib/supabase';
import { postingEngine } from '@/lib/financial/posting-engine';
import { assertTransition, isCreditNoteStatus } from './credit-note-workflow';
import { statementService } from './services/statement-service';

export interface CreditNoteLineItem { invoice_line_id?: string; description: string; credited_amount: number; reason?: string; }
export interface CreditNoteParams { entityId: string; tenantId: string; invoiceId?: string; invoiceNumber?: string; lineItems: CreditNoteLineItem[]; totalAmount: number; reason: string; createdBy?: string; periodId?: string; }

export const revenueApi = {
  generateStatement: (params: { entityId: string; tenantId: string; options?: any }) => statementService.generate(params.entityId, params.tenantId, params.options),
  getStatementHistory: (params: { entityId: string; tenantId: string }) => statementService.getHistory(params.entityId, params.tenantId),

  async issueCreditNote(params: CreditNoteParams) {
    const { data: cnId, error: cnError } = await supabase.rpc('create_credit_note', {
      p_entity_id: params.entityId, p_tenant_id: params.tenantId,
      p_invoice_id: params.invoiceId || null, p_invoice_number: params.invoiceNumber || null,
      p_total_amount: params.totalAmount, p_reason: params.reason,
      p_created_by: params.createdBy || 'system', p_line_items: params.lineItems,
    });
    if (cnError || !cnId) throw new Error(`Failed to create credit note: ${cnError?.message || 'Unknown error'}`);

    try {
      await postingEngine.post({
        source_engine: 'revenue', business_event: 'rental_credit_note_issued',
        entity_id: params.entityId, amount: params.totalAmount, period_id: params.periodId,
        occurred_at: new Date().toISOString(), effective_date: new Date().toISOString().split('T')[0],
        dimensions: { tenant_id: params.tenantId },
        metadata: { source_id: `CN-${cnId}`, created_by: params.createdBy || 'system', invoice_id: params.invoiceId, invoice_number: params.invoiceNumber, reason: params.reason },
      });
      await supabase.from('credit_notes').update({ status: 'issued', updated_at: new Date().toISOString() }).eq('id', cnId);
    } catch (postingError) {
      await supabase.from('credit_notes').update({ status: 'posting_failed', updated_at: new Date().toISOString() }).eq('id', cnId);
      throw postingError;
    }
    return cnId;
  },

  async getCreditNotes(entityId: string, tenantId?: string) {
    let query = supabase.from('credit_notes').select('*, lines:credit_note_lines(*)').eq('entity_id', entityId).order('created_at', { ascending: false });
    if (tenantId) query = query.eq('tenant_id', tenantId);
    const { data } = await query; return data || [];
  },

  async cancelCreditNote(creditNoteId: string) {
    await supabase.from('credit_notes').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', creditNoteId);
  },
};
