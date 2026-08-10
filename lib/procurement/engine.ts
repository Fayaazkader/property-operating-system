// lib/procurement/engine.ts
// Procurement Engine — Spend Request → RFQ → PO → Receipt → Invoice

import { supabase } from '@/lib/supabase';
import { publish } from '@/lib/platform/events/event-bus';
import type { SpendRequest, RFQ, Quote, PurchaseOrder } from './types';

export class ProcurementEngine {

  async createSpendRequest(params: Partial<SpendRequest>): Promise<SpendRequest> {
    const { data, error } = await supabase.from('procurement_spend_requests').insert({
      entity_id: params.entity_id, property_id: params.property_id,
      title: params.title, description: params.description,
      estimated_amount: params.estimated_amount, category: params.category,
      priority: params.priority || 'routine', status: 'draft',
      requested_by: params.requested_by,
    }).select('*').single();
    if (error) throw error;

    await publish('procurement.spend_request.created', {
      correlationId: crypto.randomUUID(), source: 'procurement-engine', version: '1.0',
      payload: { spendRequest: data },
    });
    return data as SpendRequest;
  }

  async issueRFQ(spendRequestId: string, supplierIds: string[]): Promise<RFQ> {
    const { data: sr } = await supabase.from('procurement_spend_requests').select('*').eq('id', spendRequestId).single();
    const { data, error } = await supabase.from('procurement_rfqs').insert({
      entity_id: (sr as any)?.entity_id, spend_request_id: spendRequestId,
      title: (sr as any)?.title, supplier_ids: supplierIds, status: 'issued',
      issued_at: new Date().toISOString(),
    }).select('*').single();
    if (error) throw error;

    await publish('procurement.rfq.issued', {
      correlationId: crypto.randomUUID(), source: 'procurement-engine', version: '1.0',
      payload: { rfq: data },
    });
    return data as RFQ;
  }

  async evaluateQuotes(rfqId: string, winningQuoteId: string, winningSupplierId: string): Promise<PurchaseOrder> {
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
      correlationId: crypto.randomUUID(), source: 'procurement-engine', version: '1.0',
      payload: { purchaseOrder: data },
    });
    return data as PurchaseOrder;
  }

  async receiveGoods(poId: string, receivedBy: string): Promise<void> {
    await supabase.from('procurement_purchase_orders').update({
      status: 'received', received_at: new Date().toISOString(),
    }).eq('id', poId);

    await publish('procurement.goods.received', {
      correlationId: crypto.randomUUID(), source: 'procurement-engine', version: '1.0',
      payload: { poId, receivedBy },
    });
  }
}

export const procurementEngine = new ProcurementEngine();
