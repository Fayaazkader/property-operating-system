// lib/cashbook/reconciliation-status-service.ts
// Cash Book domain — Reconciliation status for governance consumers

import { supabase } from '@/lib/supabase';

export interface ReconciliationStatus {
  balanced: boolean;
  unreconciled: number;
  totalTransactions: number;
}

export const reconciliationStatusService = {
  async getStatus(entityId: string): Promise<ReconciliationStatus> {
    const [{ count: total }, { count: unreconciled }] = await Promise.all([
      supabase.from('bank_transactions').select('id', { count: 'exact', head: true }).eq('entity_id', entityId),
      supabase.from('bank_transactions').select('id', { count: 'exact', head: true }).eq('entity_id', entityId).eq('is_reconciled', false),
    ]);
    return { balanced: (unreconciled || 0) === 0, unreconciled: unreconciled || 0, totalTransactions: total || 0 };
  }
};
