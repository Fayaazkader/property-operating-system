// lib/revenue-command/opportunity-engine.ts
// Revenue Opportunity Projection — Derived from signals, profiles, and assurance

import { supabase } from '@/lib/supabase';

export interface RevenueOpportunity {
  lease_id: string;
  tenant_name: string;
  opportunity_type: string;
  description: string;
  potential_value: number;
  probability: number;
  expected_value: number;
  action: string;
}

export class RevenueOpportunityProjection {

  async findOpportunities(entityId: string): Promise<RevenueOpportunity[]> {
    const opportunities: RevenueOpportunity[] = [];

    const { data: reliableTenants } = await supabase
      .from('tenant_revenue_profile')
      .select('*')
      .eq('entity_id', entityId)
      .gt('collection_confidence', 0.9);

    for (const t of (reliableTenants || [])) {
      const { data: lease } = await supabase
        .from('leases')
        .select('monthly_rental')
        .eq('tenant_id', t.tenant_id)
        .single();

      if (lease) {
        opportunities.push({
          lease_id: t.tenant_id,
          tenant_name: 'Tenant',
          opportunity_type: 'early_payment_discount',
          description: 'Consistently pays on time. Offer discount for early payment.',
          potential_value: lease.monthly_rental * 0.02,
          probability: 0.90,
          expected_value: lease.monthly_rental * 0.02 * 0.90,
          action: 'Send early payment discount offer',
        });
      }
    }

    return opportunities.sort((a, b) => b.expected_value - a.expected_value);
  }
}

export const revenueOpportunityProjection = new RevenueOpportunityProjection();
