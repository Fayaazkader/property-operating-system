// lib/disbursement/engine.ts
// Disbursement Engine — Production-grade supplier payments, approval, batching, bank files, cash book

import { supabase } from '@/lib/supabase';
import { publish } from '../platform/events/event-bus';
import { logger } from '../platform/events/logger.service';
import { generateBankFile } from './adapters';
import type {
  SupplierInvoice, PaymentRequest, PaymentBatch, CashBookEntry, PaymentPolicy, BankFile,
  CreateInvoiceParams, CreatePaymentRequestParams, CreateBatchParams, MorningBriefDisbursement,
} from './types';

export class DisbursementEngine {
  // ============================================================
  // INVOICES
  // ============================================================

  async createInvoice(params: CreateInvoiceParams): Promise<SupplierInvoice> {
    const total = params.amount + (params.tax_amount || 0);
    const { data, error } = await supabase
      .from('supplier_invoices')
      .insert({
        entity_id: params.entity_id,
        supplier_id: params.supplier_id,
        invoice_number: params.invoice_number,
        description: params.description,
        amount: params.amount,
        tax_amount: params.tax_amount || 0,
        total_amount: total,
        currency: params.currency || 'ZAR',
        invoice_date: params.invoice_date,
        due_date: params.due_date,
        source: params.source || 'manual',
        ocr_data: params.ocr_data,
        po_reference: params.po_reference,
        work_order_id: params.work_order_id,
        property_id: params.property_id,
        status: 'pending',
      })
      .select('*')
      .single();

    if (error) throw error;

    await publish('supplier.invoice.created', {
      correlationId: crypto.randomUUID(),
      source: 'disbursement-engine',
      version: '1.0',
      payload: { invoice: data },
    });

    return data as SupplierInvoice;
  }

  async getInvoicesByEntity(entityId: string): Promise<SupplierInvoice[]> {
    const { data } = await supabase.from('supplier_invoices').select('*').eq('entity_id', entityId).order('due_date', { ascending: true });
    return (data || []) as SupplierInvoice[];
  }

  async getOverdueInvoices(entityId: string): Promise<SupplierInvoice[]> {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('supplier_invoices').select('*').eq('entity_id', entityId).eq('status', 'approved').lt('due_date', today);
    return (data || []) as SupplierInvoice[];
  }

  // ============================================================
  // PAYMENT REQUESTS
  // ============================================================

  async createPaymentRequest(params: CreatePaymentRequestParams): Promise<PaymentRequest> {
    // Apply payment policy
    const policy = params.payment_policy ? await this.getPaymentPolicy(params.entity_id, params.payment_policy) : null;

    const status = policy?.auto_approve && (!policy.max_auto_amount || params.amount <= policy.max_auto_amount)
      ? 'approved'
      : 'pending_approval';

    const { data, error } = await supabase
      .from('payment_requests')
      .insert({
        entity_id: params.entity_id,
        invoice_id: params.invoice_id,
        supplier_id: params.supplier_id,
        amount: params.amount,
        due_date: params.due_date,
        priority: params.priority || 'normal',
        payment_method: params.payment_method || policy?.preferred_payment_method || 'eft',
        bank_account: params.bank_account,
        payment_policy: params.payment_policy,
        status,
      })
      .select('*')
      .single();

    if (error) throw error;

    await publish('payment.request.created', {
      correlationId: crypto.randomUUID(),
      source: 'disbursement-engine',
      version: '1.0',
      payload: { paymentRequest: data },
    });

    if (status === 'pending_approval') {
      await this.submitForApproval(data.id, data.entity_id, data.amount);
    } else {
      await publish('payment.request.auto_approved', {
        correlationId: crypto.randomUUID(),
        source: 'disbursement-engine',
        version: '1.0',
        payload: { paymentRequest: data, policy: policy?.name },
      });
    }

    return data as PaymentRequest;
  }

  private async submitForApproval(paymentId: string, entityId: string, amount: number): Promise<void> {
    await publish('approval.request.created', {
      correlationId: crypto.randomUUID(),
      source: 'disbursement-engine',
      version: '1.0',
      payload: {
        entity_type: 'payment_request',
        entity_id: paymentId,
        title: `Payment approval: R${amount.toLocaleString()}`,
        amount,
        entityId,
      },
    });
  }

  async approvePayment(id: string, approverId: string): Promise<void> {
    await supabase.from('payment_requests').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', id);

    await publish('payment.request.approved', {
      correlationId: crypto.randomUUID(),
      source: 'disbursement-engine',
      version: '1.0',
      payload: { paymentId: id, approvedBy: approverId },
    });
  }

  async getPendingPayments(entityId: string): Promise<PaymentRequest[]> {
    const { data } = await supabase.from('payment_requests').select('*').eq('entity_id', entityId).eq('status', 'approved').order('due_date', { ascending: true });
    return (data || []) as PaymentRequest[];
  }

  // ============================================================
  // PAYMENT BATCHES
  // ============================================================

  async createBatch(params: CreateBatchParams): Promise<PaymentBatch> {
    const payments = await this.getPaymentsByIds(params.payment_ids);
    const total = payments.reduce((sum, p) => sum + p.amount, 0);
    const batchNumber = `BATCH-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const adapter = params.bank_adapter || 'standard_eft';

    const { data, error } = await supabase
      .from('payment_batches')
      .insert({
        entity_id: params.entity_id,
        batch_number: batchNumber,
        description: params.description,
        total_amount: total,
        payment_count: payments.length,
        status: 'draft',
        bank_file_format: params.bank_file_format || 'standard',
        bank_adapter: adapter,
      })
      .select('*')
      .single();

    if (error) throw error;

    await supabase.from('payment_requests').update({ batch_id: data.id, status: 'batched' }).in('id', params.payment_ids);

    await publish('payment.batch.created', {
      correlationId: crypto.randomUUID(),
      source: 'disbursement-engine',
      version: '1.0',
      payload: { batch: data, paymentIds: params.payment_ids },
    });

    return data as PaymentBatch;
  }

  async generateBankFile(batchId: string): Promise<BankFile> {
    const { data: batch } = await supabase.from('payment_batches').select('*').eq('id', batchId).single();
    if (!batch) throw new Error('Batch not found');

    const { data: payments } = await supabase.from('payment_requests').select('*').eq('batch_id', batchId);

    const bankFile = generateBankFile(batch.bank_adapter || 'standard_eft', batch, payments || []);
    const generatedAt = new Date().toISOString();

    await supabase.from('payment_batches').update({
      bank_file_content: bankFile.content,
      bank_file_generated_at: generatedAt,
      status: 'ready',
    }).eq('id', batchId);

    await publish('payment.bank_file.generated', {
      correlationId: crypto.randomUUID(),
      source: 'disbursement-engine',
      version: '1.0',
      payload: { batchId, adapter: batch.bank_adapter },
    });

    return bankFile;
  }

  async submitBatch(batchId: string, approverId: string): Promise<void> {
    await supabase.from('payment_batches').update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      approved_by: approverId,
    }).eq('id', batchId);

    await supabase.from('payment_requests').update({ status: 'sent_to_bank', sent_to_bank_at: new Date().toISOString() }).eq('batch_id', batchId);

    await publish('payment.batch.submitted', {
      correlationId: crypto.randomUUID(),
      source: 'disbursement-engine',
      version: '1.0',
      payload: { batchId },
    });
  }

  async confirmBatch(batchId: string): Promise<void> {
    await supabase.from('payment_batches').update({ status: 'confirmed', confirmed_at: new Date().toISOString() }).eq('id', batchId);
    await supabase.from('payment_requests').update({ status: 'confirmed', confirmed_at: new Date().toISOString() }).eq('batch_id', batchId);

    await this.recordCashBookEntries(batchId);

    await publish('payment.batch.confirmed', {
      correlationId: crypto.randomUUID(),
      source: 'disbursement-engine',
      version: '1.0',
      payload: { batchId },
    });
  }

  // ============================================================
  // CASH BOOK
  // ============================================================

  private async recordCashBookEntries(batchId: string): Promise<void> {
    const { data: batch } = await supabase.from('payment_batches').select('*').eq('id', batchId).single();
    if (!batch) return;

    const { data: payments } = await supabase.from('payment_requests').select('*').eq('batch_id', batchId);

    for (const payment of payments || []) {
      await supabase.from('cash_book_entries').insert({
        entity_id: batch.entity_id,
        transaction_date: new Date().toISOString().split('T')[0],
        description: `Payment batch ${batch.batch_number}`,
        amount: payment.amount,
        type: 'debit',
        reference_type: 'payment_request',
        reference_id: payment.id,
        category: 'supplier_payment',
        bank_reference: batch.batch_number,
      });
    }

    await supabase.from('payment_batches').update({ status: 'reconciled' }).eq('id', batchId);
    await supabase.from('payment_requests').update({ status: 'reconciled' }).eq('batch_id', batchId);
  }

  async getCashBook(entityId: string, startDate?: string, endDate?: string): Promise<CashBookEntry[]> {
    let query = supabase.from('cash_book_entries').select('*').eq('entity_id', entityId).order('transaction_date', { ascending: false });
    if (startDate) query = query.gte('transaction_date', startDate);
    if (endDate) query = query.lte('transaction_date', endDate);
    const { data } = await query;
    return (data || []) as CashBookEntry[];
  }

  // ============================================================
  // PAYMENT POLICIES
  // ============================================================

  async getPaymentPolicy(entityId: string, category: string): Promise<PaymentPolicy | null> {
    const { data } = await supabase.from('payment_policies').select('*').eq('entity_id', entityId).eq('category', category).eq('is_active', true).single();
    return data as PaymentPolicy || null;
  }

  async getPaymentPolicies(entityId: string): Promise<PaymentPolicy[]> {
    const { data } = await supabase.from('payment_policies').select('*').eq('entity_id', entityId).eq('is_active', true);
    return (data || []) as PaymentPolicy[];
  }

  // ============================================================
  // MORNING BRIEF
  // ============================================================

  async getMorningBrief(entityId: string): Promise<MorningBriefDisbursement> {
    const today = new Date().toISOString().split('T')[0];

    const [{ count: awaitingApproval }, { count: overdue }, { count: batchesReady }, { data: dueToday }, { count: outstanding }] = await Promise.all([
      supabase.from('payment_requests').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).eq('status', 'pending_approval'),
      supabase.from('payment_requests').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).in('status', ['approved', 'queued']).lt('due_date', today),
      supabase.from('payment_batches').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).eq('status', 'ready'),
      supabase.from('payment_requests').select('amount').eq('entity_id', entityId).eq('due_date', today).in('status', ['approved', 'queued', 'batched']),
      supabase.from('payment_batches').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).eq('status', 'submitted'),
    ]);

    const totalDueToday = (dueToday || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    const brief: MorningBriefDisbursement = {
      payments_awaiting_approval: awaitingApproval || 0,
      payments_overdue: overdue || 0,
      batches_ready: batchesReady || 0,
      total_due_today: totalDueToday,
      confirmations_outstanding: outstanding || 0,
    };

    await publish('morning_brief.disbursement.updated', {
      correlationId: crypto.randomUUID(),
      source: 'disbursement-engine',
      version: '1.0',
      payload: brief,
    });

    return brief;
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private async getPaymentsByIds(ids: string[]): Promise<PaymentRequest[]> {
    const { data } = await supabase.from('payment_requests').select('*').in('id', ids);
    return (data || []) as PaymentRequest[];
  }
}

export const disbursementEngine = new DisbursementEngine();
