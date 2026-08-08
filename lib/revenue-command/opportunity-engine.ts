// lib/revenue-command/opportunity-engine.ts
// Revenue Opportunity Projection — Derived from signals, profiles, and assurance

import { supabase } from '@/lib/supabase';
import type { RevenueOpportunity } from './types';

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
          confidence: 0.90,
          required_effort: 'low',
          action: 'Send early payment discount offer',
        });
      }
    }

    const { data: atRiskTenants } = await supabase
      .from('tenant_revenue_profile')
      .select('*')
      .eq('entity_id', entityId)
      .lt('collection_confidence', 0.5);

    for (const t of (atRiskTenants || [])) {
      const { data: lease } = await supabase
        .from('leases')
        .select('monthly_rental')
        .eq('tenant_id', t.tenant_id)
        .single();

      if (lease) {
        opportunities.push({
          lease_id: t.tenant_id,
          tenant_name: 'Tenant',
          opportunity_type: 'payment_plan',
          description: 'Showing financial stress. Offer structured payment plan.',
          potential_value: lease.monthly_rental,
          probability: 0.65,
          expected_value: lease.monthly_rental * 0.65,
          confidence: 0.65,
          required_effort: 'medium',
          action: 'Call tenant to discuss payment plan',
        });
      }
    }

    const { data: depositUsed } = await supabase
      .from('deposit_register')
      .select('*')
      .eq('entity_id', entityId)
      .gt('amount_applied', 0);

    for (const d of (depositUsed || [])) {
      opportunities.push({
        lease_id: d.tenant_id,
        tenant_name: 'Tenant',
        opportunity_type: 'deposit_top_up',
        description: `R${d.amount_applied.toLocaleString()} of deposit used. Request top-up.`,
        potential_value: d.amount_applied,
        probability: 0.80,
        expected_value: d.amount_applied * 0.80,
        confidence: 0.80,
        required_effort: 'low',
        action: 'Send deposit top-up notice',
      });
    }

    return opportunities.sort((a, b) => b.expected_value - a.expected_value);
  }
}

export const revenueOpportunityProjection = new RevenueOpportunityProjection();
