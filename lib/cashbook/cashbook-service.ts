// lib/cashbook/cashbook-service.ts
// Cash Book Service — Called by UI. Emits events. Never calls Posting Engine directly.

import { supabase } from '@/lib/supabase';
import { publish } from '@/lib/platform/events/event-bus';
import { logger } from '@/lib/platform/events/logger.service';

export const cashbookService = {
  async confirmAllocation(transactionId: string, matchedInvoiceId: string | null, matchedTenantId?: string, matchedSupplierId?: string): Promise<{ success: boolean; message: string }> {
    // Update allocation — this is a business action, not accounting
    const { error } = await supabase
      .from('bank_transactions')
      .update({
        matched_invoice_id: matchedInvoiceId,
        matched_tenant_id: matchedTenantId || null,
        allocation_status: 'ready_to_post',
        queue: 'ready',
        updated_at: new Date().toISOString(),
      })
      .eq('id', transactionId);

    if (error) {
      logger.error('Allocation failed', { transactionId, error: error.message, code: error.code, details: error.details });
      return { success: false, message: error.message };
    }

    // Publish event — Posting Service reacts to this
    await publish('cashbook.allocation.completed', {
      correlationId: crypto.randomUUID(),
      source: 'cashbook-service',
      version: '1.0',
      payload: { transactionId, matchedInvoiceId, matchedTenantId, matchedSupplierId },
    });

    return { success: true, message: 'Allocation confirmed. Posting will follow.' };
  }
};
