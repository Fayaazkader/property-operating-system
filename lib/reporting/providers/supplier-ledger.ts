// lib/reporting/providers/supplier-ledger.ts
import { supabase } from '@/lib/supabase';

export async function getSupplierLedgerData(entityId: string, supplierId?: string) {
  let query = supabase.from('sub_ledger_entries').select('*').eq('entity_id', entityId).eq('ledger_type', 'supplier').order('posted_at', { ascending: true });
  if (supplierId) query = query.eq('supplier_id', supplierId);

  const { data: entries } = await query;
  const rows = (entries || []).map(e => [e.posted_at?.split('T')[0] || '', e.reference_id || '', e.reference_type || '', e.description || '', e.debit_amount.toLocaleString(), e.credit_amount.toLocaleString(), e.running_balance.toLocaleString()]);
  const totalDr = (entries || []).reduce((s, e) => s + (e.debit_amount || 0), 0);
  const totalCr = (entries || []).reduce((s, e) => s + (e.credit_amount || 0), 0);

  return { headers: ['Date', 'Document', 'Type', 'Description', 'Debit', 'Credit', 'Balance'], rows, totals: ['', '', '', 'TOTAL', totalDr.toLocaleString(), totalCr.toLocaleString(), ''] };
}
