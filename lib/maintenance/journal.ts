// lib/maintenance/journal.ts
// Maintenance Context Builder — Read model with cache, like Revenue

import { supabase } from '@/lib/supabase';
import type { MaintenanceJournal } from './types';

const cache = new Map<string, { data: MaintenanceJournal; expires: number }>();
const TTL = 60000; // 60 seconds

export async function buildJournal(issueId: string, entityId: string): Promise<MaintenanceJournal | null> {
  // Check cache
  const cached = cache.get(issueId);
  if (cached && Date.now() < cached.expires) return cached.data;

  const { data: issue } = await supabase.from('maintenance_issues').select('*').eq('id', issueId).single();
  if (!issue) return null;

  const { data: workOrders } = await supabase.from('work_orders').select('*').eq('issue_id', issueId);
  const woIds = (workOrders || []).map((w: any) => w.id);
  const { data: visits } = woIds.length > 0
    ? await supabase.from('supplier_visits').select('*').in('work_order_id', woIds)
    : { data: [] };

  // Timeline from activity_feed
  const { data: events } = await supabase
    .from('activity_feed')
    .select('*')
    .eq('reference_id', issueId)
    .order('occurred_at', { ascending: true });

  const timeline = (events || []).map((e: any) => ({
    timestamp: e.occurred_at,
    event: e.event_type?.replace(/_/g, ' ') || 'Event',
    detail: e.description || '',
  }));

  const journal: MaintenanceJournal = {
    issue_id: issueId, issue, work_orders: workOrders || [], visits: visits || [], timeline,
  };

  // Cache
  cache.set(issueId, { data: journal, expires: Date.now() + TTL });

  return journal;
}

export function invalidateJournal(issueId: string): void {
  cache.delete(issueId);
}
