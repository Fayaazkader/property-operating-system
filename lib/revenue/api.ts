// lib/revenue/api.ts
import { supabase } from '@/lib/supabase';
import { postingEngine } from '@/lib/financial/posting-engine';
import { statementService } from './services/statement-service';

export interface CreditNoteLineItem {
  invoice_line_id?: string;
  description: string;
  credited_amount: number;
  reason?: string;
}

export interface CreditNoteParams {
  entityId: string;
  tenantId: string;
  invoiceId?: string;
  invoiceNumber?: string;
  lineItems: CreditNoteLineItem[];
  totalAmount: number;
  reason: string;
  createdBy?: string;
}

export const revenueApi = {
  generateStatement: (params: { entityId: string; tenantId: string; options?: any }) =>
    statementService.generate(params.entityId, params.tenantId, params.options),

  getStatementHistory: (params: { entityId: string; tenantId: string }) =>
    statementService.getHistory(params.entityId, params.tenantId),

  async issueCreditNote(params: CreditNoteParams) {
    // 1. Post the credit note journal
    await postingEngine.post({
      source_engine: 'revenue',
      business_event: 'rental_credit_note_issued',
      entity_id: params.entityId,
      amount: params.totalAmount,
      occurred_at: new Date().toISOString(),
      effective_date: new Date().toISOString().split('T')[0],
      dimensions: { tenant_id: params.tenantId },
      metadata: {
        source_id: `CN-${Date.now()}`,
        created_by: params.createdBy || 'system',
        invoice_id: params.invoiceId,
        invoice_number: params.invoiceNumber,
        reason: params.reason,
      },
    });

    // 2. Store credit note with lines
    const { data: cn } = await supabase.from('credit_notes').insert({
      entity_id: params.entityId,
      tenant_id: params.tenantId,
      invoice_id: params.invoiceId || null,
      invoice_number: params.invoiceNumber || null,
      total_amount: params.totalAmount,
      reason: params.reason,
      status: 'issued',
      created_by: params.createdBy,
    }).select('id').single();

    if (cn?.id && params.lineItems?.length) {
      await supabase.from('credit_note_lines').insert(
        params.lineItems.map(l => ({
          credit_note_id: cn.id,
          invoice_line_id: l.invoice_line_id || null,
          description: l.description,
          credited_amount: l.credited_amount,
          reason: l.reason || params.reason,
        }))
      );
    }
  },

  async getCreditNotes(entityId: string, tenantId?: string) {
    let query = supabase.from('credit_notes').select('*, lines:credit_note_lines(*)').eq('entity_id', entityId).order('created_at', { ascending: false });
    if (tenantId) query = query.eq('tenant_id', tenantId);
    const { data } = await query;
    return data || [];
  },

  async cancelCreditNote(creditNoteId: string) {
    await supabase.from('credit_notes').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', creditNoteId);
  },
};
