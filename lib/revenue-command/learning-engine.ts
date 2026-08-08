// lib/revenue-command/learning-engine.ts
// Revenue Learning — Closed feedback loop. Measures what works.

import { supabase } from '@/lib/supabase';

export interface InterventionResult {
  intervention_type: string;
  tenant_type?: string;
  channel?: string;
  outcome: string;
  success: boolean;
  duration_days: number;
}

export interface ChannelEffectiveness {
  channel: string;
  tenant_type: string;
  success_rate: number;
  avg_response_days: number;
  sample_size: number;
}

export class BehaviourLearningEngine {

  async recordResult(params: {
    intervention_id: string;
    outcome: string;
    success: boolean;
    duration_days: number;
  }): Promise<void> {
    await supabase.from('revenue_interventions').update({
      outcome: params.outcome,
      successful: params.success,
      completed_at: new Date().toISOString(),
      duration_minutes: params.duration_days * 24 * 60,
    }).eq('id', params.intervention_id);

    await this.updateChannelEffectiveness();
  }

  async getChannelEffectiveness(entityId: string): Promise<ChannelEffectiveness[]> {
    const { data } = await supabase
      .from('revenue_interventions')
      .select('channel, outcome, successful, duration_minutes')
      .eq('entity_id', entityId)
      .not('outcome', 'is', null);

    const grouped: Record<string, { successes: number; total: number; totalDuration: number }> = {};

    for (const intervention of (data || [])) {
      const key = intervention.channel || 'unknown';
      if (!grouped[key]) grouped[key] = { successes: 0, total: 0, totalDuration: 0 };
      grouped[key].total++;
      if (intervention.successful) grouped[key].successes++;
      grouped[key].totalDuration += intervention.duration_minutes || 0;
    }

    const results: ChannelEffectiveness[] = [];
    for (const [channel, stats] of Object.entries(grouped)) {
      results.push({
        channel,
        tenant_type: 'all',
        success_rate: stats.total > 0 ? Math.round((stats.successes / stats.total) * 100) : 0,
        avg_response_days: stats.total > 0 ? Math.round((stats.totalDuration / stats.total) / 1440 * 10) / 10 : 0,
        sample_size: stats.total,
      });
    }

    return results.sort((a, b) => b.success_rate - a.success_rate);
  }

  async getBestDecision(tenantType: string, entityId: string): Promise<string> {
    const effectiveness = await this.getChannelEffectiveness(entityId);
    const best = effectiveness[0];
    return best?.channel || 'whatsapp';
  }

  async learnFromOutcome(decisionType: string, success: boolean): Promise<void> {
    // Update the confidence model for future decisions
    // In production, this would update a Bayesian model or similar
    const { data } = await supabase
      .from('revenue_decisions')
      .select('confidence')
      .eq('decision_type', decisionType)
      .not('outcome', 'is', null)
      .limit(50);

    const total = (data?.length || 0) + 1;
    const successes = (data?.filter(d => (d as any).outcome === 'success').length || 0) + (success ? 1 : 0);
    const newConfidence = Math.round((successes / total) * 100) / 100;

    console.log(`Updated confidence for ${decisionType}: ${newConfidence} (${successes}/${total})`);
  }

  private async updateChannelEffectiveness(): Promise<void> {
    // Recalculate and cache channel effectiveness
    // Will be used by the Decisions engine to choose channels
  }
}

export const behaviourLearningEngine = new BehaviourLearningEngine();
