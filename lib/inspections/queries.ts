// lib/inspections/queries.ts — Read operations only
import { supabase } from '@/lib/supabase';

export async function getInspections(entityId: string, limit = 50) {
  const { data } = await supabase.from('inspections').select('*').eq('entity_id', entityId).order('scheduled_date', { ascending: false }).limit(limit);
  return data || [];
}

export async function getUpcomingInspections(entityId: string) {
  const { data } = await supabase.from('inspections').select('*').eq('entity_id', entityId).eq('status', 'scheduled').order('scheduled_date', { ascending: true }).limit(20);
  return data || [];
}

export async function getOverdueInspections(entityId: string) {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase.from('inspections').select('*').eq('entity_id', entityId).eq('status', 'scheduled').lt('scheduled_date', today);
  return data || [];
}

export async function getInspectionHistory(entityId: string, limit = 50) {
  const { data } = await supabase.from('inspections').select('*').eq('entity_id', entityId).in('status', ['completed', 'cancelled']).order('completed_date', { ascending: false }).limit(limit);
  return data || [];
}
