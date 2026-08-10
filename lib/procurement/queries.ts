// lib/procurement/queries.ts — Read operations only
import { supabase } from '@/lib/supabase';

export async function getSpendRequests(entityId: string) {
  const { data } = await supabase.from('procurement_spend_requests').select('*').eq('entity_id', entityId).order('created_at', { ascending: false }).limit(50);
  return data || [];
}

export async function getRFQs(entityId: string) {
  const { data } = await supabase.from('procurement_rfqs').select('*').eq('entity_id', entityId).order('created_at', { ascending: false }).limit(20);
  return data || [];
}

export async function getQuotes(rfqId: string) {
  const { data } = await supabase.from('procurement_quotes').select('*').eq('rfq_id', rfqId);
  return data || [];
}

export async function getPurchaseOrders(entityId: string) {
  const { data } = await supabase.from('procurement_purchase_orders').select('*').eq('entity_id', entityId).order('created_at', { ascending: false }).limit(30);
  return data || [];
}

export async function getSupplierInvoices(entityId: string) {
  const { data } = await supabase.from('procurement_supplier_invoices').select('*').eq('entity_id', entityId).order('created_at', { ascending: false }).limit(30);
  return data || [];
}
