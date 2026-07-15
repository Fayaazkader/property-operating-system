// lib/disbursement/types.ts
// Disbursement Operations Types — Production Grade

export type InvoiceStatus = 'pending' | 'approved' | 'rejected' | 'paid' | 'cancelled';
export type InvoiceSource = 'manual' | 'ocr' | 'purchase_order' | 'work_order' | 'automation';

export type PaymentStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'queued'
  | 'batched'
  | 'sent_to_bank'
  | 'awaiting_confirmation'
  | 'confirmed'
  | 'reconciled'
  | 'failed';

export type BatchStatus = 'draft' | 'ready' | 'submitted' | 'awaiting_confirmation' | 'confirmed' | 'reconciled' | 'failed';
export type PaymentMethod = 'eft' | 'immediate_payment' | 'cheque' | 'cash';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type ScheduleType = 'on_due' | 'before_due' | 'after_due' | 'weekly' | 'biweekly' | 'monthly' | 'immediate' | 'manual';

export interface SupplierInvoice {
  id: string;
  entity_id: string;
  supplier_id: string;
  invoice_number: string;
  description: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  invoice_date: string;
  due_date: string;
  status: InvoiceStatus;
  source: InvoiceSource;
  ocr_data?: any;
  payment_terms?: string;
  po_reference?: string;
  work_order_id?: string;
  property_id?: string;
  attachments: any[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface BankAccount {
  bank_name: string;
  account_number: string;
  account_type: string;
  branch_code: string;
  account_holder: string;
  reference: string;
}

export interface PaymentRequest {
  id: string;
  entity_id: string;
  invoice_id?: string;
  supplier_id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  priority: Priority;
  due_date: string;
  payment_method: PaymentMethod;
  bank_account?: BankAccount;
  payment_policy?: string;
  approval_id?: string;
  batch_id?: string;
  sent_to_bank_at?: string;
  confirmed_at?: string;
  failed_at?: string;
  failure_reason?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentBatch {
  id: string;
  entity_id: string;
  batch_number: string;
  description: string;
  total_amount: number;
  payment_count: number;
  status: BatchStatus;
  bank_file_format: string;
  bank_adapter: string;
  bank_file_content?: string;
  bank_file_generated_at?: string;
  submitted_at?: string;
  confirmed_at?: string;
  approved_by?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CashBookEntry {
  id: string;
  entity_id: string;
  transaction_date: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  reference_type?: string;
  reference_id?: string;
  category?: string;
  bank_reference?: string;
  reconciled: boolean;
  reconciled_at?: string;
  created_at: string;
}

export interface PaymentPolicy {
  id: string;
  entity_id: string;
  name: string;
  category: string;
  pay_days_before_due: number;
  pay_on_due: boolean;
  auto_approve: boolean;
  requires_manual_approval: boolean;
  max_auto_amount?: number;
  preferred_payment_method: PaymentMethod;
  schedule_type: ScheduleType;
  schedule_day?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BankFile {
  batch_id: string;
  format: string;
  adapter: string;
  content: string;
  total_amount: number;
  payment_count: number;
  generated_at: string;
}

export interface MorningBriefDisbursement {
  payments_awaiting_approval: number;
  payments_overdue: number;
  batches_ready: number;
  total_due_today: number;
  confirmations_outstanding: number;
}

export interface CreateInvoiceParams {
  entity_id: string;
  supplier_id: string;
  invoice_number: string;
  description: string;
  amount: number;
  tax_amount?: number;
  invoice_date: string;
  due_date: string;
  currency?: string;
  source?: InvoiceSource;
  ocr_data?: any;
  po_reference?: string;
  work_order_id?: string;
  property_id?: string;
}

export interface CreatePaymentRequestParams {
  entity_id: string;
  invoice_id?: string;
  supplier_id: string;
  amount: number;
  due_date: string;
  priority?: Priority;
  payment_method?: PaymentMethod;
  bank_account?: BankAccount;
  payment_policy?: string;
}

export interface CreateBatchParams {
  entity_id: string;
  description: string;
  payment_ids: string[];
  bank_file_format?: string;
  bank_adapter?: string;
}
