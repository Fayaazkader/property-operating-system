import { supabase } from '@/lib/supabase';
import { publish } from '@/lib/platform/events/event-bus';
import type { PurchaseOrder } from '../types';

export async function createPO(rfqId: string, winningQuoteId: string, winningSupplierId: string): Promise<PurchaseOrder> {
  const { data: quote } = await supabase.from('procurement_quotes').select('*').eq('id', winningQuoteId).single();
  const { data: rfq } = await supabase.from('procurement_rfqs').select('*').eq('id', rfqId).single();

  const { data, error } = await supabase.from('procurement_purchase_orders').insert({
    entity_id: (rfq as any)?.entity_id, spend_request_id: (rfq as any)?.spend_request_id,
    supplier_id: winningSupplierId, quote_id: winningQuoteId,
    amount: (quote as any)?.amount, status: 'draft',
  }).select('*').single();
  if (error) throw error;

  await supabase.from('procurement_rfqs').update({ status: 'evaluated', closed_at: new Date().toISOString() }).eq('id', rfqId);
  await supabase.from('procurement_spend_requests').update({ status: 'approved' }).eq('id', (rfq as any)?.spend_request_id);

  await publish('procurement.po.created', {
    correlationId: crypto.randomUUID(), source: 'procurement', version: '1.0',
    payload: { purchaseOrder: data },
  });
  return data as PurchaseOrder;
}

export async function receiveGoods(poId: string, receivedBy: string): Promise<void> {
  await supabase.from('procurement_purchase_orders').update({
    status: 'received', received_at: new Date().toISOString(),
  }).eq('id', poId);

  await publish('procurement.goods.received', {
    correlationId: crypto.randomUUID(), source: 'procurement', version: '1.0',
    payload: { poId, receivedBy },
  });
}
