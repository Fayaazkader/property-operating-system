// lib/revenue-command/decision-registry.ts
// Decision Registry — AI audit trail. Records every automated decision.

import { supabase } from '@/lib/supabase';

export interface DecisionRecord {
  id: string;
  entity_id: string;
  lease_id: string;
  decision_type: string;
  reason: string;
  confidence: number;
  signals_used: string[];
  policy_applied: string;
  playbook_selected: string;
  action_taken: string;
  outcome?: string;
  created_at: string;
}

export class DecisionRegistry {

  async record(params: {
    entity_id: string;
    lease_id: string;
    decision_type: string;
    reason: string;
    confidence: number;
    signals_used: string[];
    policy_applied: string;
    playbook_selected: string;
    action_taken: string;
  }): Promise<DecisionRecord> {
    const record: DecisionRecord = {
      id: crypto.randomUUID(),
      entity_id: params.entity_id,
      lease_id: params.lease_id,
      decision_type: params.decision_type,
      reason: params.reason,
      confidence: params.confidence,
      signals_used: params.signals_used,
      policy_applied: params.policy_applied,
      playbook_selected: params.playbook_selected,
      action_taken: params.action_taken,
      created_at: new Date().toISOString(),
    };

    await supabase.from('decision_registry').insert(record);

    return record;
  }

  async getDecisionHistory(leaseId: string): Promise<DecisionRecord[]> {
    const { data } = await supabase
      .from('decision_registry')
      .select('*')
      .eq('lease_id', leaseId)
      .order('created_at', { ascending: false })
      .limit(50);

    return (data || []) as DecisionRecord[];
  }

  async explainDecision(decisionId: string): Promise<string> {
    const { data } = await supabase
      .from('decision_registry')
      .select('*')
      .eq('id', decisionId)
      .single();

    if (!data) return 'Decision not found';

    const d = data as DecisionRecord;
    return `AssetFlow decided to ${d.action_taken} because ${d.reason}. ` +
      `Confidence was ${Math.round(d.confidence * 100)}%. ` +
      `Policy applied: ${d.policy_applied}. Playbook: ${d.playbook_selected}. ` +
      `Signals considered: ${d.signals_used.join(', ')}.`;
  }
}

export const decisionRegistry = new DecisionRegistry();
