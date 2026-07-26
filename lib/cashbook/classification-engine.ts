// lib/cashbook/classification-engine.ts
// Transaction Classification — Bank-agnostic, not description-based

import { supabase } from '@/lib/supabase';

export type TransactionClass = 'tenant_receipt' | 'supplier_payment' | 'bank_charge' | 'interest_earned' | 'transfer' | 'refund' | 'unknown';

export interface ClassificationResult {
  class: TransactionClass;
  confidence: number;
  reason: string;
}

export const classificationEngine = {
  async classify(transaction: {
    id: string;
    credit_amount?: number; debit_amount?: number; transaction_amount?: number;
    description?: string;
    matched_invoice_id?: string;
    matched_tenant_id?: string;
    matched_supplier_id?: string;
  }): Promise<ClassificationResult> {
    // 1. If matched to a tenant invoice → tenant receipt
    if (transaction.matched_tenant_id) {
      return { class: 'tenant_receipt', confidence: 95, reason: 'Matched to tenant invoice' };
    }

    // 2. If matched to a supplier → supplier payment
    if (transaction.matched_supplier_id) {
      return { class: 'supplier_payment', confidence: 95, reason: 'Matched to supplier' };
    }

    // 3. If amount is positive (credit) and has tenant match → receipt
    if ((transaction.credit_amount || 0) > 0 || (transaction.transaction_amount || 0) > 0 && transaction.matched_tenant_id) {
      return { class: 'tenant_receipt', confidence: 80, reason: 'Positive amount with tenant match' };
    }

    // 4. If amount is negative (debit) and has supplier match → payment
    if ((transaction.debit_amount || 0) > 0 && transaction.matched_supplier_id) {
      return { class: 'supplier_payment', confidence: 80, reason: 'Negative amount with supplier match' };
    }

    // 5. Small debit amounts are typically bank charges
    if ((transaction.debit_amount || 0) > 0 && Math.abs(transaction.debit_amount || transaction.transaction_amount || 0) < 500) {
      return { class: 'bank_charge', confidence: 60, reason: 'Small debit amount, likely bank charge' };
    }

    // 6. Small credit amounts are typically interest
    if ((transaction.credit_amount || 0) > 0 || (transaction.transaction_amount || 0) > 0 && transaction.amount < 100) {
      return { class: 'interest_earned', confidence: 50, reason: 'Small credit amount, likely interest' };
    }

    return { class: 'unknown', confidence: 0, reason: 'Cannot classify — needs manual review' };
  }
};
