import { supabase } from '@/lib/supabase';
import type { MaintenanceJournal } from './types';

export async function buildJournal(issueId: string, entityId: string): Promise<MaintenanceJournal | null> {
  const { data: issue } = await supabase.from('maintenance_issues').select('*').eq('id', issueId).single();
  if (!issue) return null;

  const { data: workOrders } = await supabase.from('work_orders').select('*').eq('issue_id', issueId);
  const { data: visits } = await supabase
    .from('supplier_visits')
    .select('*')
    .in('work_order_id', (workOrders || []).map((w: any) => w.id));

  const timeline: Array<{ timestamp: string; event: string; detail: string }> = [];
  if (issue.created_at) timeline.push({ timestamp: issue.created_at, event: 'Reported', detail: `Via ${issue.reported_via}` });
  if (issue.category) timeline.push({ timestamp: issue.updated_at || issue.created_at, event: 'Classified', detail: `${issue.category} — ${issue.priority}` });

  for (const wo of (workOrders || [])) {
    timeline.push({ timestamp: wo.created_at, event: 'Work Order Created', detail: wo.title });
    if (wo.supplier_id) timeline.push({ timestamp: wo.updated_at || wo.created_at, event: 'Supplier Assigned', detail: `Supplier: ${wo.supplier_id}` });
    if (wo.status === 'completed') timeline.push({ timestamp: wo.completed_date || wo.updated_at, event: 'Completed', detail: `Cost: R${wo.supplier_cost?.toLocaleString() || '0'}` });
  }

  for (const v of (visits || [])) {
    if (v.scheduled_at) timeline.push({ timestamp: v.scheduled_at, event: 'Visit Scheduled', detail: '' });
    if (v.arrived_at) timeline.push({ timestamp: v.arrived_at, event: 'Supplier On-Site', detail: '' });
    if (v.tenant_confirmed) timeline.push({ timestamp: v.completed_at || v.arrived_at || '', event: 'Tenant Confirmed', detail: '' });
  }

  timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const journal: MaintenanceJournal = {
    issue_id: issueId, issue, work_orders: workOrders || [], visits: visits || [], timeline,
  };

  await supabase.from('maintenance_journal').upsert({
    issue_id: issueId, entity_id: entityId, snapshot_data: journal, generated_at: new Date().toISOString(),
  }, { onConflict: 'issue_id' });

  return journal;
}
