// lib/revenue/billing-status-service.ts
// Revenue domain — Billing status for governance consumers

import { supabase } from '@/lib/supabase';

export interface BillingStatus {
  completed: boolean;
  invoicesGenerated: number;
  activeLeases: number;
  hasExceptions: boolean;
}

export const billingStatusService = {
  async getStatus(entityId: string): Promise<BillingStatus> {
    const [{ count: activeLeases }, { count: invoicesGenerated }] = await Promise.all([
      supabase.from('leases').select('id', { count: 'exact', head: true }).eq('lease_status', 'Active').eq('owner_entity_id', entityId),
      supabase.from('journals').select('id', { count: 'exact', head: true }).eq('entity_id', entityId).eq('source_event', 'rental_invoice_raised'),
    ]);
    return { completed: (invoicesGenerated || 0) > 0, invoicesGenerated: invoicesGenerated || 0, activeLeases: activeLeases || 0, hasExceptions: false };
  }
};
