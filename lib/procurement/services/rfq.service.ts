import { supabase } from '@/lib/supabase';
import { publish } from '@/lib/platform/events/event-bus';
import type { RFQ } from '../types';

export async function issueRFQ(spendRequestId: string, supplierIds: string[]): Promise<RFQ> {
  const { data: sr } = await supabase.from('procurement_spend_requests').select('*').eq('id', spendRequestId).single();
  const { data, error } = await supabase.from('procurement_rfqs').insert({
    entity_id: (sr as any)?.entity_id, spend_request_id: spendRequestId,
    title: (sr as any)?.title, supplier_ids: supplierIds, status: 'issued',
    issued_at: new Date().toISOString(),
  }).select('*').single();
  if (error) throw error;

  await publish('procurement.rfq.issued', {
    correlationId: crypto.randomUUID(), source: 'procurement', version: '1.0',
    payload: { rfq: data },
  });
  return data as RFQ;
}
