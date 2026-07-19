// lib/accounts-payable/engine.ts
// Accounts Payable Engine — Complete with lifecycle, bulk, intelligence

import { supabase } from '@/lib/supabase';
import { postingEngine } from '@/lib/financial/posting-engine';
import { publish } from '@/lib/platform/events/event-bus';
import { logger } from '@/lib/platform/events/logger.service';

export type LifecycleStatus = 'captured' | 'ocr_review' | 'finance_review' | 'approved' | 'posted' | 'partially_paid' | 'paid' | 'closed';

export interface SupplierInvoiceInput {
  entityId: string;
  supplierId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  description?: string;
  source?: string;
  ocrData?: any;
  ocrConfidence?: number;
  lines: InvoiceLineInput[];
  notes?: string;
  createdBy?: string;
  requiresReview?: boolean;
}

export interface InvoiceLineInput {
  propertyId?: string;
  glCode: string;
  description: string;
  amount: number;
  vatCode?: string;
  vatRate?: number;
  costCentre?: string;
}

export interface CreditNoteInput {
  entityId: string;
  supplierId: string;
  originalInvoiceId: string;
  amount: number;
  reason: string;
}

export interface RecurringExpenseInput {
  entityId: string;
  supplierId?: string;
  propertyId?: string;
  description: string;
  glCode: string;
  amount: number;
  tolerancePct?: number;
  vatTreatment?: string;
  frequency?: string;
  expectedDay?: number;
}

export interface BulkCaptureInput {
  entityId: string;
  files: Array<{ fileName: string; fileUrl: string; mimeType: string }>;
}

export const apEngine = {
  // ═══════════════════════════════════════
  // INVOICE CAPTURE — Full Lifecycle
  // ═══════════════════════════════════════

  async captureInvoice(input: SupplierInvoiceInput): Promise<any> {
    const { data: existing } = await supabase
      .from('supplier_invoices_new')
      .select('id')
      .eq('supplier_id', input.supplierId)
      .eq('invoice_number', input.invoiceNumber)
      .eq('invoice_date', input.invoiceDate)
      .single();

    const initialStatus: LifecycleStatus = input.requiresReview ? 'captured' : 'finance_review';
    const totalAmount = input.lines.reduce((s, l) => s + l.amount, 0);
    const vatAmount = input.lines.reduce((s, l) => s + (l.vatRate ? Math.round(l.amount * (l.vatRate / 100) * 100) / 100 : 0), 0);

    const { data: invoice, error } = await supabase
      .from('supplier_invoices_new')
      .insert({
        entity_id: input.entityId, supplier_id: input.supplierId,
        invoice_number: input.invoiceNumber, invoice_date: input.invoiceDate, due_date: input.dueDate,
        description: input.description, total_amount: totalAmount, vat_amount: vatAmount,
        status: initialStatus === 'posted' ? 'posted' : 'draft',
        lifecycle_status: initialStatus,
        source: input.source || 'manual', ocr_data: input.ocrData, ocr_confidence: input.ocrConfidence,
        requires_review: initialStatus !== 'approved', duplicate_checked: !!existing, duplicate_of: existing?.id,
        notes: input.notes, created_by: input.createdBy,
      })
      .select('*').single();
    if (error) throw error;

    for (const line of input.lines) {
      const vatRate = line.vatRate || 15;
      const vatAmount = line.vatCode === 'non_vatable' ? 0 : Math.round(line.amount * (vatRate / 100) * 100) / 100;
      await supabase.from('supplier_invoice_lines').insert({
        invoice_id: invoice.id, property_id: line.propertyId || null,
        gl_code: line.glCode, description: line.description, amount: line.amount,
        vat_code: line.vatCode || 'standard', vat_rate: vatRate, vat_amount: vatAmount,
        total: line.amount + vatAmount, cost_centre: line.costCentre,
      });
    }

    await publish('supplier.invoice.captured', { correlationId: crypto.randomUUID(), source: 'ap-engine', version: '1.0', payload: { invoiceId: invoice.id, supplierId: input.supplierId, lifecycle: initialStatus } });
    return invoice;
  },

  async approveInvoice(invoiceId: string, approvedBy: string): Promise<void> {
    await supabase.from('supplier_invoices_new').update({ lifecycle_status: 'approved', approved_by: approvedBy, updated_at: new Date().toISOString() }).eq('id', invoiceId);
    await publish('supplier.invoice.approved', { correlationId: crypto.randomUUID(), source: 'ap-engine', version: '1.0', payload: { invoiceId, approvedBy } });
  },

  async postInvoice(invoiceId: string, postedBy: string): Promise<void> {
    const { data: invoice } = await supabase.from('supplier_invoices_new').select('*, lines:supplier_invoice_lines(*)').eq('id', invoiceId).single();
    if (!invoice || invoice.lifecycle_status === 'posted') return;

    for (const line of (invoice as any).lines || []) {
      await postingEngine.post({
        source_engine: 'ap', business_event: 'supplier_invoice_captured',
        entity_id: invoice.entity_id, amount: line.amount,
        occurred_at: invoice.invoice_date, effective_date: invoice.invoice_date,
        dimensions: { supplier_id: invoice.supplier_id, property_id: line.property_id, cost_centre: line.cost_centre },
        metadata: { source_id: invoice.id, invoice_number: invoice.invoice_number, gl_code: line.gl_code, description: line.description, created_by: postedBy },
      });
    }

    await supabase.from('supplier_invoices_new').update({ lifecycle_status: 'posted', status: 'posted', posted_by: postedBy, posted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', invoiceId);
    await supabase.from('suppliers').update({ last_invoice_at: new Date().toISOString() }).eq('id', invoice.supplier_id);
    await publish('supplier.invoice.posted', { correlationId: crypto.randomUUID(), source: 'ap-engine', version: '1.0', payload: { invoiceId } });
  },

  async rejectInvoice(invoiceId: string, reason: string): Promise<void> {
    await supabase.from('supplier_invoices_new').update({ lifecycle_status: 'captured', notes: `Rejected: ${reason}`, updated_at: new Date().toISOString() }).eq('id', invoiceId);
  },

  // ═══════════════════════════════════════
  // BULK CAPTURE
  // ═══════════════════════════════════════

  async bulkCapture(input: BulkCaptureInput): Promise<{ processed: number; drafts: any[] }> {
    const drafts: any[] = [];
    for (const file of input.files) {
      const draft = await this.captureInvoice({
        entityId: input.entityId, supplierId: '', invoiceNumber: `DRAFT-${Date.now()}-${file.fileName}`,
        invoiceDate: new Date().toISOString().split('T')[0], dueDate: new Date().toISOString().split('T')[0],
        source: 'bulk', ocrData: { fileName: file.fileName, fileUrl: file.fileUrl },
        lines: [{ glCode: '', description: 'Pending OCR review', amount: 0 }],
        requiresReview: true,
      });
      drafts.push(draft);
    }
    return { processed: drafts.length, drafts };
  },

  // ═══════════════════════════════════════
  // CREDIT NOTES
  // ═══════════════════════════════════════

  async issueCreditNote(input: CreditNoteInput): Promise<any> {
    const { data: original } = await supabase.from('supplier_invoices_new').select('*').eq('id', input.originalInvoiceId).single();
    if (!original) throw new Error('Original invoice not found');

    const cnNumber = `CN-${original.invoice_number}`;
    const { data: creditNote, error } = await supabase.from('supplier_credit_notes').insert({
      entity_id: input.entityId, supplier_id: input.supplierId, original_invoice_id: input.originalInvoiceId,
      credit_note_number: cnNumber, amount: input.amount, reason: input.reason, status: 'posted',
    }).select('*').single();
    if (error) throw error;

    await postingEngine.post({
      source_engine: 'ap', business_event: 'supplier_credit_note_received',
      entity_id: input.entityId, amount: input.amount,
      occurred_at: new Date().toISOString(), effective_date: new Date().toISOString().split('T')[0],
      dimensions: { supplier_id: input.supplierId },
      metadata: { source_id: creditNote.id, original_invoice_id: input.originalInvoiceId, reason: input.reason, created_by: 'system' },
    });

    await publish('supplier.credit_note.issued', { correlationId: crypto.randomUUID(), source: 'ap-engine', version: '1.0', payload: { creditNoteId: creditNote.id, supplierId: input.supplierId, amount: input.amount } });
    return creditNote;
  },

  // ═══════════════════════════════════════
  // RECURRING EXPENSES
  // ═══════════════════════════════════════

  async createRecurringExpense(input: RecurringExpenseInput): Promise<any> {
    const { data, error } = await supabase.from('recurring_expenses').insert({
      entity_id: input.entityId, supplier_id: input.supplierId, property_id: input.propertyId,
      description: input.description, gl_code: input.glCode, amount: input.amount,
      tolerance_pct: input.tolerancePct || 10, vat_treatment: input.vatTreatment || 'standard',
      frequency: input.frequency || 'monthly', expected_day: input.expectedDay || new Date().getDate(),
      next_due_date: new Date().toISOString().split('T')[0], status: 'active',
    }).select('*').single();
    if (error) throw error;
    return data;
  },

  async matchRecurringExpense(transaction: { description: string; amount: number; date: string }): Promise<any> {
    const { data: recurring } = await supabase.from('recurring_expenses').select('*').eq('status', 'active');
    for (const r of (recurring || [])) {
      const toleranceAmount = r.amount * (r.tolerance_pct / 100);
      if (Math.abs(transaction.amount - r.amount) <= toleranceAmount) {
        return { matched: true, recurringExpense: r, confidence: Math.round((1 - Math.abs(transaction.amount - r.amount) / r.amount) * 100), suggestion: `Recurring expense matched: ${r.description} (R${r.amount} ± ${r.tolerance_pct}%)` };
      }
    }
    return { matched: false };
  },

  // ═══════════════════════════════════════
  // QUERIES
  // ═══════════════════════════════════════

  async getApprovalQueue(entityId: string): Promise<any[]> {
    const { data } = await supabase.from('supplier_invoices_new').select('*, supplier:supplier_id(supplier_name), lines:supplier_invoice_lines(*)').eq('entity_id', entityId).in('lifecycle_status', ['captured', 'ocr_review', 'finance_review']).order('created_at', { ascending: false });
    return data || [];
  },

  async getSupplierLedger(supplierId: string): Promise<any> {
    const [invoices, creditNotes, payments] = await Promise.all([
      supabase.from('supplier_invoices_new').select('*').eq('supplier_id', supplierId).order('invoice_date', { ascending: false }),
      supabase.from('supplier_credit_notes').select('*').eq('supplier_id', supplierId),
      supabase.from('sub_ledger_entries').select('*').eq('supplier_id', supplierId).eq('ledger_type', 'supplier').order('posted_at', { ascending: false }),
    ]);
    return { invoices: invoices.data || [], creditNotes: creditNotes.data || [], payments: payments.data || [] };
  },

  async getSupplierScore(supplierId: string): Promise<any> {
    const [{ count: invoiceCount }, { data: invoices }, { count: lateCount }] = await Promise.all([
      supabase.from('supplier_invoices_new').select('*', { count: 'exact', head: true }).eq('supplier_id', supplierId),
      supabase.from('supplier_invoices_new').select('total_amount, due_date').eq('supplier_id', supplierId).eq('lifecycle_status', 'posted'),
      supabase.from('supplier_invoices_new').select('*', { count: 'exact', head: true }).eq('supplier_id', supplierId).eq('lifecycle_status', 'posted').lt('due_date', new Date().toISOString().split('T')[0]),
    ]);
    const outstanding = (invoices || []).reduce((s: number, i: any) => s + i.total_amount, 0);
    return { invoiceCount: invoiceCount || 0, outstanding, latePayments: lateCount || 0 };
  },

  async getOutstandingAP(entityId: string): Promise<number> {
    const { data } = await supabase.from('supplier_invoices_new').select('total_amount').eq('entity_id', entityId).eq('lifecycle_status', 'posted');
    return (data || []).reduce((s: number, i: any) => s + i.total_amount, 0);
  },

  async getAging(entityId: string): Promise<any> {
    const today = new Date();
    const { data: invoices } = await supabase.from('supplier_invoices_new').select('total_amount, due_date').eq('entity_id', entityId).eq('lifecycle_status', 'posted');
    const aging = { current: 0, days30: 0, days60: 0, days90: 0, days120: 0 };
    for (const inv of (invoices || [])) {
      const daysOverdue = Math.floor((today.getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24));
      if (daysOverdue <= 0) aging.current += inv.total_amount;
      else if (daysOverdue <= 30) aging.days30 += inv.total_amount;
      else if (daysOverdue <= 60) aging.days60 += inv.total_amount;
      else if (daysOverdue <= 90) aging.days90 += inv.total_amount;
      else aging.days120 += inv.total_amount;
    }
    return aging;
  },

  async getMonthEndStatus(entityId: string): Promise<any> {
    const [drafts, duplicates, unallocated] = await Promise.all([
      supabase.from('supplier_invoices_new').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).neq('lifecycle_status', 'posted').neq('lifecycle_status', 'closed'),
      supabase.from('supplier_invoices_new').select('id').eq('entity_id', entityId).eq('duplicate_checked', true),
      supabase.from('supplier_invoices_new').select('id').eq('entity_id', entityId).eq('lifecycle_status', 'posted'),
    ]);
    return { hasDrafts: (drafts.count || 0) === 0, hasDuplicates: (duplicates.data || []).length === 0, pendingCount: drafts.count || 0, ready: (drafts.count || 0) === 0 };
  }
};
