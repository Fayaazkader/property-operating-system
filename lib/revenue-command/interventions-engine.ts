// lib/revenue-command/interventions-engine.ts
// Revenue Interventions — Tracks every automated action and its outcome

import { supabase } from '@/lib/supabase';

export interface InterventionSummary {
  total_interventions: number;
  recovered_amount: number;
  avg_recovery_days: number;
  success_rate: number;
  by_type: Record<string, { count: number; recovered: number }>;
}

export class RevenueInterventionsEngine {

  async recordIntervention(params: {
    entity_id: string;
    lease_id: string;
    tenant_id: string;
    intervention_type: string;
    channel?: string;
    amount_at_risk: number;
    outcome?: string;
  }): Promise<void> {
    await supabase.from('revenue_interventions').insert({
      entity_id: params.entity_id,
      lease_id: params.lease_id,
      tenant_id: params.tenant_id,
      intervention_type: params.intervention_type,
      channel: params.channel,
      amount_at_risk: params.amount_at_risk,
      outcome: params.outcome || 'pending',
      created_at: new Date().toISOString(),
    });
  }

  async recordOutcome(interventionId: string, outcome: string, recoveredAmount?: number): Promise<void> {
    await supabase.from('revenue_interventions').update({
      outcome,
      recovered_amount: recoveredAmount || 0,
      resolved_at: new Date().toISOString(),
    }).eq('id', interventionId);
  }

  async getSummary(entityId: string, startDate: string, endDate: string): Promise<InterventionSummary> {
    const { data } = await supabase
      .from('revenue_interventions')
      .select('*')
      .eq('entity_id', entityId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const interventions = data || [];
    const total = interventions.length;
    const recovered = interventions
      .filter(i => i.outcome === 'recovered')
      .reduce((s, i) => s + (i.recovered_amount || 0), 0);

    // Calculate average recovery time
    const recoveredInterventions = interventions.filter(i => i.resolved_at);
    const avgDays = recoveredInterventions.length > 0
      ? recoveredInterventions.reduce((s, i) => {
          const start = new Date(i.created_at);
          const end = new Date(i.resolved_at);
          return s + (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        }, 0) / recoveredInterventions.length
      : 0;

    // Group by type
    const byType: Record<string, { count: number; recovered: number }> = {};
    for (const i of interventions) {
      if (!byType[i.intervention_type]) {
        byType[i.intervention_type] = { count: 0, recovered: 0 };
      }
      byType[i.intervention_type].count++;
      if (i.outcome === 'recovered') {
        byType[i.intervention_type].recovered += i.recovered_amount || 0;
      }
    }

    return {
      total_interventions: total,
      recovered_amount: recovered,
      avg_recovery_days: Math.round(avgDays * 10) / 10,
      success_rate: total > 0 ? Math.round((interventions.filter(i => i.outcome === 'recovered').length / total) * 100) : 0,
      by_type: byType,
    };
  }
}

export const revenueInterventionsEngine = new RevenueInterventionsEngine();
