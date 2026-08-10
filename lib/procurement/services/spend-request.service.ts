import { supabase } from '@/lib/supabase';
import { publish } from '@/lib/platform/events/event-bus';
import type { SpendRequest } from '../types';

export async function createSpendRequest(params: Partial<SpendRequest>): Promise<SpendRequest> {
  const { data, error } = await supabase.from('procurement_spend_requests').insert({
    entity_id: params.entity_id, property_id: params.property_id,
    title: params.title, description: params.description,
    estimated_amount: params.estimated_amount, category: params.category,
    priority: params.priority || 'routine', status: 'draft',
    requested_by: params.requested_by,
  }).select('*').single();
  if (error) throw error;

  await publish('procurement.spend_request.created', {
    correlationId: crypto.randomUUID(), source: 'procurement', version: '1.0',
    payload: { spendRequest: data },
  });
  return data as SpendRequest;
}

export async function getSpendRequests(entityId: string): Promise<SpendRequest[]> {
  const { data } = await supabase.from('procurement_spend_requests').select('*').eq('entity_id', entityId).order('created_at', { ascending: false }).limit(50);
  return (data || []) as SpendRequest[];
}
