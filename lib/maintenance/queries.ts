// lib/maintenance/queries.ts — Read operations only
import { supabase } from '@/lib/supabase';

export async function getIssues(entityId: string, limit = 100) {
  const { data } = await supabase.from('maintenance_issues').select('*').eq('entity_id', entityId).order('created_at', { ascending: false }).limit(limit);
  return data || [];
}

export async function getIssue(id: string) {
  const { data } = await supabase.from('maintenance_issues').select('*').eq('id', id).single();
  return data;
}

export async function getWorkOrders(entityId: string) {
  const { data } = await supabase.from('work_orders').select('*').eq('entity_id', entityId).order('created_at', { ascending: false }).limit(50);
  return data || [];
}

export async function getWorkOrdersByIssue(issueId: string) {
  const { data } = await supabase.from('work_orders').select('*').eq('issue_id', issueId);
  return data || [];
}

export async function getVisits(workOrderIds: string[]) {
  if (!workOrderIds.length) return [];
  const { data } = await supabase.from('supplier_visits').select('*').in('work_order_id', workOrderIds);
  return data || [];
}

export async function getQuotes(entityId: string) {
  const { data } = await supabase.from('maintenance_quotes').select('*').eq('entity_id', entityId).order('created_at', { ascending: false }).limit(20);
  return data || [];
}

export async function getPreventativeSchedules(entityId: string) {
  const { data } = await supabase.from('maintenance_schedules').select('*').eq('entity_id', entityId).order('next_due', { ascending: true });
  return data || [];
}

export async function getAssets(entityId: string) {
  const { data } = await supabase.from('property_assets').select('*').eq('entity_id', entityId).order('name');
  return data || [];
}
