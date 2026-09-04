// lib/cashbook/classification-engine.ts
// Transaction Classification — Bank-agnostic, not description-based


export type TransactionClass = 'tenant_receipt' | 'supplier_payment' | 'bank_charge' | 'interest_earned' | 'transfer' | 'refund' | 'unknown';

export interface ClassificationResult {
  class: TransactionClass;
  confidence: number;
  reason: string;
}

export const classificationEngine = {
  async classify(transaction: {
    id: string;
    credit_amount?: number;
    debit_amount?: number;
    transaction_amount?: number;
    description?: string;
    matched_invoice_id?: string;
    matched_tenant_id?: string;
    matched_supplier_id?: string;
  }): Promise<ClassificationResult> {
    // Strong evidence only: tenant match means tenant receipt.
    if (transaction.matched_tenant_id) {
      return {
        class: 'tenant_receipt',
        confidence: 95,
        reason: 'Matched to tenant',
      };
    }

    // Strong evidence only: supplier match means supplier payment.
    if (transaction.matched_supplier_id) {
      return {
        class: 'supplier_payment',
        confidence: 95,
        reason: 'Matched to supplier',
      };
    }

    const amount = Number(transaction.transaction_amount || 0);
    const debitAmount = Number(transaction.debit_amount || 0);
    const creditAmount = Number(transaction.credit_amount || 0);
    const description = (transaction.description || '').toLowerCase();

    // Bank charge: explicit debit evidence and no tenant/supplier allocation.
    if (
      debitAmount > 0 &&
      Math.abs(debitAmount || amount) < 500 &&
      description.includes('bank')
    ) {
      return {
        class: 'bank_charge',
        confidence: 90,
        reason: 'Small bank debit identified as bank charge',
      };
    }

    // Interest: explicit credit evidence and description evidence.
    if (
      (creditAmount > 0 || amount > 0) &&
      description.includes('interest')
    ) {
      return {
        class: 'interest_earned',
        confidence: 90,
        reason: 'Credit identified as bank interest',
      };
    }

    return {
      class: 'unknown',
      confidence: 0,
      reason: 'Cannot classify safely — needs manual review',
    };
  },
};
