// lib/intelligence/timeline-provider.ts
// Timeline Provider — Reads from activity_feed, not signals

import { supabase } from '@/lib/supabase';

export interface TimelineEvent {
  timestamp: string;
  event: string;
  detail: string;
  domain: string;
}

export async function getTimeline(entityId: string, limit = 20): Promise<TimelineEvent[]> {
  const { data } = await supabase
    .from('activity_feed')
    .select('*')
    .eq('reference_id', entityId)
    .order('occurred_at', { ascending: false })
    .limit(limit);

  return (data || []).map((e: any) => ({
    timestamp: e.occurred_at,
    event: e.event_type?.replace(/_/g, ' ') || 'Event',
    detail: e.description || '',
    domain: e.signal_category || 'general',
  }));
}
