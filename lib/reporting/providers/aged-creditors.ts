// lib/reporting/providers/aged-creditors.ts
// Ages open supplier invoices. Uses explicit allocation records if available, falls back to FIFO.

import { supabase } from '@/lib/supabase';

export async function getAgedCreditorsData(entityId: string) {
  const { data: invoices } = await supabase
    .from('sub_ledger_entries')
    .select('id, supplier_id, credit_amount, posted_at, reference_id, description')
    .eq('entity_id', entityId)
    .eq('ledger_type', 'supplier')
    .gt('credit_amount', 0)
    .order('posted_at', { ascending: true });

  if (!invoices?.length) {
    return { headers: ['Supplier', 'Current', '30 Days', '60 Days', '90 Days', '120+ Days', 'Total'], rows: [], totals: [] };
  }

  // Check for explicit allocation records first
  const invoiceIds = invoices.map(i => i.id);
  const { data: allocations } = await supabase
    .from('payment_allocations')
    .select('invoice_id, amount_applied')
    .in('invoice_id', invoiceIds);

  const allocationMap = new Map<string, number>();
  (allocations || []).forEach(a => {
    allocationMap.set(a.invoice_id, (allocationMap.get(a.invoice_id) || 0) + (a.amount_applied || 0));
  });

  // Fallback: get payments for FIFO
  const supplierIds = [...new Set(invoices.map(i => i.supplier_id))];
  const { data: payments } = await supabase
    .from('sub_ledger_entries')
    .select('supplier_id, debit_amount, posted_at')
    .eq('entity_id', entityId)
    .eq('ledger_type', 'supplier')
    .gt('debit_amount', 0)
    .in('supplier_id', supplierIds)
    .order('posted_at', { ascending: true });

  const now = Date.now();
  const supplierAging = new Map<string, { current: number; d30: number; d60: number; d90: number; d120: number }>();

  for (const inv of invoices) {
    const supplierId = inv.supplier_id;
    if (!supplierAging.has(supplierId)) {
      supplierAging.set(supplierId, { current: 0, d30: 0, d60: 0, d90: 0, d120: 0 });
    }

    // Use explicit allocation if available
    let remaining = inv.credit_amount || 0;
    const allocated = allocationMap.get(inv.id) || 0;
    remaining -= allocated;

    // FIFO fallback for unallocated remainder
    if (remaining > 0) {
      const invDate = new Date(inv.posted_at);
      const supplierPayments = (payments || []).filter(p => p.supplier_id === supplierId && new Date(p.posted_at) >= invDate);
      for (const pmt of supplierPayments) {
        if (remaining <= 0) break;
        const applied = Math.min(remaining, pmt.debit_amount || 0);
        remaining -= applied;
        pmt.debit_amount -= applied;
      }
    }

    if (remaining > 0) {
      const daysOld = Math.floor((now - new Date(inv.posted_at).getTime()) / (1000 * 60 * 60 * 24));
      const aging = supplierAging.get(supplierId)!;
      if (daysOld <= 30) aging.current += remaining;
      else if (daysOld <= 60) aging.d30 += remaining;
      else if (daysOld <= 90) aging.d60 += remaining;
      else if (daysOld <= 120) aging.d90 += remaining;
      else aging.d120 += remaining;
    }
  }

  const rows: string[][] = [];
  let totalCurrent = 0, total30 = 0, total60 = 0, total90 = 0, total120 = 0;

  for (const [supplierId, aging] of supplierAging) {
    const { data: supplier } = await supabase.from('suppliers').select('supplier_name').eq('id', supplierId).single();
    const total = aging.current + aging.d30 + aging.d60 + aging.d90 + aging.d120;
    if (total === 0) continue;
    totalCurrent += aging.current; total30 += aging.d30; total60 += aging.d60; total90 += aging.d90; total120 += aging.d120;
    rows.push([supplier?.supplier_name || 'Unknown', aging.current.toLocaleString(), aging.d30.toLocaleString(), aging.d60.toLocaleString(), aging.d90.toLocaleString(), aging.d120.toLocaleString(), total.toLocaleString()]);
  }

  return {
    headers: ['Supplier', 'Current', '30 Days', '60 Days', '90 Days', '120+ Days', 'Total'],
    rows,
    totals: ['TOTAL', totalCurrent.toLocaleString(), total30.toLocaleString(), total60.toLocaleString(), total90.toLocaleString(), total120.toLocaleString(), (totalCurrent + total30 + total60 + total90 + total120).toLocaleString()],
  };
}
