// lib/revenue-command/activity-feed.ts
// Revenue Activity Feed — Timeline projection, no queries

import { supabase } from '@/lib/supabase';
import type { RevenueActivityEvent, SignalCategory } from './types';

export class RevenueActivityFeed {

  async record(params: {
    entity_id: string;
    reference_type: string;
    reference_id: string;
    signal_category: SignalCategory;
    event_type: string;
    description?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await supabase.from('revenue_activity_feed').insert({
      entity_id: params.entity_id,
      reference_type: params.reference_type,
      reference_id: params.reference_id,
      signal_category: params.signal_category,
      event_type: params.event_type,
      description: params.description,
      metadata: params.metadata || {},
    });
  }

  async getTimeline(
    entityId: string, 
    referenceType: string, 
    referenceId: string,
    limit: number = 50
  ): Promise<RevenueActivityEvent[]> {
    const { data } = await supabase
      .from('revenue_activity_feed')
      .select('*')
      .eq('entity_id', entityId)
      .eq('reference_type', referenceType)
      .eq('reference_id', referenceId)
      .order('occurred_at', { ascending: false })
      .limit(limit);

    return (data || []) as RevenueActivityEvent[];
  }

  async getPortfolioActivity(entityId: string, limit: number = 100): Promise<RevenueActivityEvent[]> {
    const { data } = await supabase
      .from('revenue_activity_feed')
      .select('*')
      .eq('entity_id', entityId)
      .order('occurred_at', { ascending: false })
      .limit(limit);

    return (data || []) as RevenueActivityEvent[];
  }
}

export const revenueActivityFeed = new RevenueActivityFeed();
