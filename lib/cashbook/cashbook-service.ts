// lib/cashbook/cashbook-service.ts
// Cash Book Service — Called by UI.
// Owns allocation evidence and emits the allocation event.
// Never calls Posting Engine directly.

import { supabase } from '@/lib/supabase';
import { publish } from '@/lib/platform/events/event-bus';
import { logger } from '@/lib/platform/events/logger.service';

export type AllocationEvidence = {
  category: string;
  amount: number;
  invoiceId?: string | null;
  tenantId?: string | null;
  supplierId?: string | null;
  propertyId?: string | null;
  glAccountId?: string | null;
  notes?: string | null;
};

export type ConfirmAllocationInput = {
  matchedInvoiceId?: string | null;
  matchedTenantId?: string | null;
  matchedSupplierId?: string | null;
  allocations: AllocationEvidence[];
};

export const cashbookService = {
  async confirmAllocation(
    transactionId: string,
    input: ConfirmAllocationInput
  ): Promise<{ success: boolean; message: string }> {

    // Load the transaction so allocation integrity is calculated
    // against the actual bank transaction amount.
    const { data: transaction, error: transactionError } = await supabase
      .from('bank_transactions')
      .select('id, transaction_amount, split_allocations')
      .eq('id', transactionId)
      .single();

    if (transactionError || !transaction) {
      logger.error('Allocation failed — transaction not found', {
        transactionId,
        error: transactionError?.message,
      });

      return {
        success: false,
        message: transactionError?.message || 'Transaction not found',
      };
    }

    const transactionAmount = Math.abs(
      Number(transaction.transaction_amount || 0)
    );

    const allocations = input.allocations || [];

    const allocatedAmount = allocations.reduce(
      (total, allocation) => total + Number(allocation.amount || 0),
      0
    );

    const tolerance = 0.01;

    let allocationStatus:
      | 'unallocated'
      | 'partially_allocated'
      | 'fully_allocated';

    if (allocatedAmount <= tolerance) {
      allocationStatus = 'unallocated';
    } else if (
      allocatedAmount <
      transactionAmount - tolerance
    ) {
      allocationStatus = 'partially_allocated';
    } else if (
      Math.abs(allocatedAmount - transactionAmount) <= tolerance
    ) {
      allocationStatus = 'fully_allocated';
    } else {
      return {
        success: false,
        message:
          `Allocation exceeds transaction amount. ` +
          `Transaction: ${transactionAmount.toFixed(2)}, ` +
          `Allocated: ${allocatedAmount.toFixed(2)}`,
      };
    }

    // A fully allocated transaction MUST contain actual allocation evidence.
    if (
      allocationStatus === 'fully_allocated' &&
      allocations.length === 0
    ) {
      return {
        success: false,
        message: 'Cannot mark transaction fully allocated without allocation evidence.',
      };
    }

    const splitAllocations = allocations.map((allocation, index) => ({
      id: crypto.randomUUID(),
      category: allocation.category,
      amount: Number(allocation.amount),
      percentage:
        transactionAmount > 0
          ? Number(
              (
                (Number(allocation.amount) / transactionAmount) *
                100
              ).toFixed(2)
            )
          : 0,
      invoiceId: allocation.invoiceId || null,
      tenantId: allocation.tenantId || null,
      supplierId: allocation.supplierId || null,
      propertyId: allocation.propertyId || null,
      glAccountId: allocation.glAccountId || null,
      notes: allocation.notes || null,
      sequence: index + 1,
    }));

    // Only fully allocated transactions are ready for posting.
    const queue =
  allocationStatus === 'fully_allocated'
    ? 'ready'
    : 'review';

    const { error } = await supabase
      .from('bank_transactions')
      .update({
        matched_invoice_id: input.matchedInvoiceId || null,
        matched_tenant_id: input.matchedTenantId || null,
        split_allocations: splitAllocations,
        allocation_status: allocationStatus,
        queue,
        reconciliation_notes:
          allocationStatus === 'fully_allocated'
            ? 'Allocation confirmed with complete allocation evidence'
            : `Allocation confirmed — ${allocatedAmount.toFixed(2)} of ${transactionAmount.toFixed(2)} allocated`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transactionId);

    if (error) {
      logger.error('Allocation failed', {
        transactionId,
        error: error.message,
        code: error.code,
        details: error.details,
      });

      return {
        success: false,
        message: error.message,
      };
    }

    await publish('cashbook.allocation.completed', {
      correlationId: crypto.randomUUID(),
      source: 'cashbook-service',
      version: '1.0',
      payload: {
        transactionId,
        matchedInvoiceId: input.matchedInvoiceId || null,
        matchedTenantId: input.matchedTenantId || null,
        matchedSupplierId: input.matchedSupplierId || null,
        allocationStatus,
        allocatedAmount,
        transactionAmount,
        allocationCount: splitAllocations.length,
      },
    });

    return {
      success: true,
      message:
        allocationStatus === 'fully_allocated'
          ? 'Allocation confirmed. Transaction is ready for posting.'
          : 'Partial allocation recorded. Transaction remains in review.',
    };
  },
};