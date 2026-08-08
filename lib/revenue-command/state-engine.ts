// lib/revenue-command/state-engine.ts
// Revenue State — Every lease is always in one state

import { supabase } from '@/lib/supabase';
import { publish } from '@/lib/platform/events/event-bus';
import { activityFeed } from './activity-feed';

export type RevenueState = 
  | 'healthy' 
  | 'watching' 
  | 'at_risk' 
  | 'recovering' 
  | 'protected' 
  | 'legal' 
  | 'terminated';

export interface StateTransition {
  lease_id: string;
  from_state: RevenueState;
  to_state: RevenueState;
  reason: string;
  triggered_by: string;
  timestamp: string;
}

const STATE_TRANSITIONS: Record<RevenueState, RevenueState[]> = {
  healthy: ['watching', 'at_risk', 'terminated'],
  watching: ['healthy', 'at_risk', 'protected'],
  at_risk: [.watching., .intervening., .recovering., 'protected', 'legal', 'terminated'],
  recovering: ['healthy', 'watching', 'at_risk', 'terminated'],
  protected: ['healthy', 'recovering', 'at_risk', 'legal', 'terminated'],
  legal: ['recovering', 'protected', 'terminated'],
  terminated: [],
};

export class RevenueStateEngine {

  async getState(leaseId: string): Promise<RevenueState> {
    const { data } = await supabase
      .from('revenue_states')
      .select('state')
      .eq('lease_id', leaseId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return (data?.state as RevenueState) || 'healthy';
  }

  async transition(
    leaseId: string,
    entityId: string,
    toState: RevenueState,
    reason: string,
    triggeredBy: string
  ): Promise<StateTransition> {
    const fromState = await this.getState(leaseId);

    // Validate transition
    const allowed = STATE_TRANSITIONS[fromState];
    if (!allowed?.includes(toState)) {
      throw new Error(`Invalid state transition: ${fromState} → ${toState}`);
    }

    const transition: StateTransition = {
      lease_id: leaseId,
      from_state: fromState,
      to_state: toState,
      reason,
      triggered_by: triggeredBy,
      timestamp: new Date().toISOString(),
    };

    await supabase.from('revenue_states').insert({
      lease_id: leaseId,
      entity_id: entityId,
      state: toState,
      reason,
      triggered_by: triggeredBy,
    });

    await activityFeed.record({
      entity_id: entityId,
      reference_type: 'lease',
      reference_id: leaseId,
      signal_category: 'behaviour',
      event_type: 'state_changed',
      description: `${fromState} → ${toState}: ${reason}`,
      metadata: transition as any,
    });

    await publish('revenue.state.changed', {
      correlationId: crypto.randomUUID(),
      source: 'revenue-state',
      version: '1.0',
      payload: transition,
    });

    return transition;
  }

  async getStateHistory(leaseId: string): Promise<StateTransition[]> {
    const { data } = await supabase
      .from('revenue_states')
      .select('*')
      .eq('lease_id', leaseId)
      .order('created_at', { ascending: false });

    return (data || []) as any;
  }
}

export const revenueStateEngine = new RevenueStateEngine();
