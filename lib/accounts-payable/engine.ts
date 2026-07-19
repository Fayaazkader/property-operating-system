// lib/accounts-payable/engine.ts
// Accounts Payable Engine — Production Complete

import { supabase } from '@/lib/supabase';
import { postingEngine } from '@/lib/financial/posting-engine';
import { publish } from '@/lib/platform/events/event-bus';

export type LifecycleStatus = 'captured' | 'ocr_processing' | 'ocr_review' | 'finance_review' | 'approved' | 'posting_queue' | 'posted' | 'partially_paid' | 'paid' | 'closed';

export interface SupplierInvoiceInput {
  entityId: string; supplierId: string; invoiceNumber: string;
  invoiceDate: string; dueDate: string; description?: string;
  source?: string; ocrData?: any; ocrConfidence?: number;
  lines: InvoiceLineInput[]; notes?: string; createdBy?: string;
  requiresReview?: boolean; supplierAccountId?: string;
}

export interface InvoiceLineInput {
  propertyId?: string; glCode: string; description: string;
  amount: number; vatCode?: string; vatRate?: number; costCentre?: string;
}

export interface StatementReconciliationResult {
  matched: Array<{ statementLine: any; invoice?: any; payment?: any }>;
  unmatched: Array<{ statementLine: any }>;
  missingInvoices: Array<{ description: string; amount: number; date: string }>;
  differences: Array<{ type: string; amount: number; description: string }>;
}

export const apEngine = {
  async captureInvoice(input: SupplierInvoiceInput): Promise<any> {
    const { data: existing } = await supabase.from('supplier_invoices_new').select('id').eq('supplier_id', input.supplierId).eq('invoice_number', input.invoiceNumber).eq('invoice_date', input.invoiceDate).single();
    const initialStatus: LifecycleStatus = input.requiresReview ? 'captured' : 'finance_review';
    const totalAmount = input.lines.reduce((s, l) => s + l.amount, 0);
    const vatAmount = input.lines.reduce((s, l) => s + (l.vatRate ? Math.round(l.amount * (l.vatRate / 100) * 100) / 100 : 0), 0);

    const { data: invoice, error } = await supabase.from('supplier_invoices_new').insert({
      entity_id: input.entityId, supplier_id: input.supplierId, invoice_number: input.invoiceNumber,
      invoice_date: input.invoiceDate, due_date: input.dueDate, description: input.description,
      total_amount: totalAmount, vat_amount: vatAmount,
      status: initialStatus === 'posted' ? 'posted' : 'draft', lifecycle_status: initialStatus,
      source: input.source || 'manual', ocr_data: input.ocrData, ocr_confidence: input.ocrConfidence,
      requires_review: initialStatus !== 'approved', duplicate_checked: !!existing, duplicate_of: existing?.id,
      notes: input.notes, created_by: input.createdBy,
    }).select('*').single();
    if (error) throw error;

    for (const line of input.lines) {
      const vatRate = line.vatRate || 15;
      const vatAmount = line.vatCode === 'non_vatable' ? 0 : Math.round(line.amount * (vatRate / 100) * 100) / 100;
      await supabase.from('supplier_invoice_lines').insert({
        invoice_id: invoice.id, property_id: line.propertyId || null, gl_code: line.glCode,
        description: line.description, amount: line.amount, vat_code: line.vatCode || 'standard',
        vat_rate: vatRate, vat_amount: vatAmount, total: line.amount + vatAmount, cost_centre: line.costCentre,
      });
    }

    await publish('supplier.invoice.captured', { correlationId: crypto.randomUUID(), source: 'ap-engine', version: '1.0', payload: { invoiceId: invoice.id, supplierId: input.supplierId, lifecycle: initialStatus } });
    return invoice;
  },

  async transitionLifecycle(invoiceId: string, to: LifecycleStatus, actor?: string): Promise<void> {
    await supabase.from('supplier_invoices_new').update({ lifecycle_status: to, updated_at: new Date().toISOString() }).eq('id', invoiceId);
    await publish('supplier.invoice.lifecycle', { correlationId: crypto.randomUUID(), source: 'ap-engine', version: '1.0', payload: { invoiceId, from: 'previous', to, actor } });
  },

  async approveInvoice(invoiceId: string, approvedBy: string): Promise<void> {
    await this.transitionLifecycle(invoiceId, 'approved', approvedBy);
  },

  async queueForPosting(invoiceId: string): Promise<void> {
    await this.transitionLifecycle(invoiceId, 'posting_queue');
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

    await supabase.from('supplier_invoices_new').update({ lifecycle_status: 'posted', status: 'posted', posted_by: postedBy, posted_at: new Date().toISOString() }).eq('id', invoiceId);
    await supabase.from('suppliers').update({ last_invoice_at: new Date().toISOString() }).eq('id', invoice.supplier_id);
    await publish('supplier.invoice.posted', { correlationId: crypto.randomUUID(), source: 'ap-engine', version: '1.0', payload: { invoiceId } });
  },

  async rejectInvoice(invoiceId: string, reason: string): Promise<void> {
    await supabase.from('supplier_invoices_new').update({ lifecycle_status: 'captured', notes: `Rejected: ${reason}` }).eq('id', invoiceId);
  },

  // ═══════════════════════════════════════
  // STATEMENT RECONCILIATION
  // ═══════════════════════════════════════

  async reconcileStatement(entityId: string, supplierId: string, lines: Array<{ date: string; description: string; reference?: string; debit?: number; credit?: number }>): Promise<StatementReconciliationResult> {
    const { data: statement } = await supabase.from('supplier_statements').insert({
      entity_id: entityId, supplier_id: supplierId, statement_date: new Date().toISOString().split('T')[0],
      closing_balance: lines.reduce((s, l) => s + (l.debit || 0) - (l.credit || 0), 0), status: 'imported',
    }).select('*').single();

    const result: StatementReconciliationResult = { matched: [], unmatched: [], missingInvoices: [], differences: [] };
    const { data: supplierInvoices } = await supabase.from('supplier_invoices_new').select('*').eq('supplier_id', supplierId).eq('lifecycle_status', 'posted');

    for (const line of lines) {
      const { data: savedLine } = await supabase.from('supplier_statement_lines').insert({
        statement_id: statement.id, transaction_date: line.date, description: line.description,
        reference: line.reference, debit: line.debit || 0, credit: line.credit || 0,
        match_status: 'unmatched',
      }).select('*').single();

      // Try to match against invoices
      let matched = false;
      for (const inv of (supplierInvoices || [])) {
        if (Math.abs((line.debit || 0) - inv.total_amount) < 1 && line.date === inv.invoice_date) {
          await supabase.from('supplier_statement_lines').update({ matched_invoice_id: inv.id, match_status: 'matched' }).eq('id', savedLine.id);
          result.matched.push({ statementLine: savedLine, invoice: inv });
          matched = true;
          break;
        }
      }

      if (!matched) {
        result.unmatched.push({ statementLine: savedLine });
        if (line.debit && line.debit > 0) {
          result.missingInvoices.push({ description: line.description, amount: line.debit, date: line.date });
        }
      }
    }

    // Find invoices not on statement
    for (const inv of (supplierInvoices || [])) {
      const onStatement = result.matched.find(m => m.invoice?.id === inv.id);
      if (!onStatement) {
        result.differences.push({ type: 'invoice_not_on_statement', amount: inv.total_amount, description: inv.invoice_number });
      }
    }

    await publish('supplier.statement.reconciled', { correlationId: crypto.randomUUID(), source: 'ap-engine', version: '1.0', payload: { supplierId, statementId: statement.id, matched: result.matched.length, unmatched: result.unmatched.length } });
    return result;
  },

  // ═══════════════════════════════════════
  // SUPPLIER ACCOUNTS (per property)
  // ═══════════════════════════════════════

  async createSupplierAccount(entityId: string, supplierId: string, propertyId: string, accountNumber: string, accountName?: string): Promise<any> {
    const { data, error } = await supabase.from('supplier_accounts').insert({
      entity_id: entityId, supplier_id: supplierId, property_id: propertyId,
      account_number: accountNumber, account_name: accountName,
    }).select('*').single();
    if (error) throw error;
    return data;
  },

  async getSupplierAccounts(supplierId: string): Promise<any[]> {
    const { data } = await supabase.from('supplier_accounts').select('*, property:property_id(property_name)').eq('supplier_id', supplierId);
    return data || [];
  },

  // ═══════════════════════════════════════
  // QUERIES
  // ═══════════════════════════════════════

  async getApprovalQueue(entityId: string): Promise<any[]> {
    const { data } = await supabase.from('supplier_invoices_new').select('*, supplier:supplier_id(supplier_name)').eq('entity_id', entityId).in('lifecycle_status', ['captured', 'ocr_review', 'finance_review']).order('created_at', { ascending: false });
    return data || [];
  },

  async getSupplierLedger(supplierId: string): Promise<any> {
    const [invoices, creditNotes, payments, accounts] = await Promise.all([
      supabase.from('supplier_invoices_new').select('*').eq('supplier_id', supplierId).order('invoice_date', { ascending: false }),
      supabase.from('supplier_credit_notes').select('*').eq('supplier_id', supplierId),
      supabase.from('sub_ledger_entries').select('*').eq('supplier_id', supplierId).eq('ledger_type', 'supplier').order('posted_at', { ascending: false }),
      this.getSupplierAccounts(supplierId),
    ]);
    return { invoices: invoices.data || [], creditNotes: creditNotes.data || [], payments: payments.data || [], accounts: accounts || [] };
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
    const [{ count: draftCount }, { data: warnings }] = await Promise.all([
      supabase.from('supplier_invoices_new').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).neq('lifecycle_status', 'posted').neq('lifecycle_status', 'closed'),
      supabase.from('supplier_invoices_new').select('id').eq('entity_id', entityId).eq('duplicate_checked', true),
    ]);
    return { hasDrafts: (draftCount || 0) === 0, hasDuplicates: (warnings || []).length === 0, pendingCount: draftCount || 0, ready: (draftCount || 0) === 0 };
  }
};

  async createRecurringExpense(input: { entityId: string; supplierId?: string; propertyId?: string; description: string; glCode: string; amount: number; tolerancePct?: number; vatTreatment?: string; frequency?: string; expectedDay?: number }): Promise<any> {
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
