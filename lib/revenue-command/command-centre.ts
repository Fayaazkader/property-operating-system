// lib/revenue-command/command-centre.ts
// Revenue Command Centre — The morning screen

import { revenueAssuranceEngine } from './assurance-engine';

export interface CommandCentreData {
  expected_today: number;
  collected_today: number;
  confidence: number;
  at_risk: number;
  protected_today: number;
  actions_overnight: number;
  tenants_requiring_attention: number;
  top_priority: {
    lease_id: string;
    tenant_name: string;
    amount: number;
    reason: string;
    recommended_action: string;
  } | null;
}

export class RevenueCommandCentre {
  async getMorningView(entityId: string): Promise<CommandCentreData> {
    const today = new Date().toISOString().split('T')[0];
    await revenueAssuranceEngine.generateRevenueOutlook(entityId);

    const { data: outlook } = await (await import('@/lib/supabase')).supabase
      .from('revenue_outlooks')
      .select('*')
      .eq('entity_id', entityId)
      .eq('snapshot_date', today)
      .single();

    const protected_data = await revenueAssuranceEngine.calculateRevenueProtected(entityId, today, today);
    const topPriority = outlook?.top_priorities?.[0] || null;

    return {
      expected_today: outlook?.expected_today || 0,
      collected_today: outlook?.collected_today || 0,
      confidence: outlook?.collection_confidence || 0,
      at_risk: outlook?.at_risk || 0,
      protected_today: protected_data.protected_amount,
      actions_overnight: protected_data.actions_taken,
      tenants_requiring_attention: outlook?.top_priorities?.length || 0,
      top_priority: topPriority ? {
        lease_id: topPriority.lease_id,
        tenant_name: topPriority.tenant_name || 'Unknown',
        amount: topPriority.amount,
        reason: topPriority.risk === 'high' ? 'Payment overdue' : 'Behaviour change detected',
        recommended_action: topPriority.action || 'Review account',
      } : null,
    };
  }
}

export const revenueCommandCentre = new RevenueCommandCentre();
