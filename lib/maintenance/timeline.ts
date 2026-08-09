// lib/maintenance/timeline.ts
// Event-driven timeline — derived from event bus, not tables

import { supabase } from '@/lib/supabase';

export async function getTimeline(issueId: string): Promise<Array<{ timestamp: string; event: string; detail: string }>> {
  // Read from activity_feed where reference_id = issueId
  const { data } = await supabase
    .from('activity_feed')
    .select('*')
    .eq('reference_id', issueId)
    .order('occurred_at', { ascending: true });

  return (data || []).map((e: any) => ({
    timestamp: e.occurred_at,
    event: e.event_type?.replace(/_/g, ' ') || 'Event',
    detail: e.description || '',
  }));
}
