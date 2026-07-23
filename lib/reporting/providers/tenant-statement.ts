// lib/reporting/providers/tenant-statement.ts
import { supabase } from '@/lib/supabase';

export async function getTenantStatementData(entityId: string, tenantId?: string) {
  let query = supabase
    .from('sub_ledger_entries')
    .select('*')
    .eq('entity_id', entityId)
    .eq('ledger_type', 'tenant')
    .order('posted_at', { ascending: true });
  if (tenantId) query = query.eq('tenant_id', tenantId);

  const { data: entries } = await query;
  if (!entries?.length) return { headers: ['Date', 'Reference', 'Description', 'Debit', 'Credit', 'Balance'], rows: [], totals: [] };

  const openingBalance = entries[0].running_balance - entries[0].debit_amount + entries[0].credit_amount;
  const rows: string[][] = [];

  if (openingBalance !== 0) {
    rows.push(['', '', 'Opening Balance', '', '', openingBalance.toLocaleString()]);
  }

  for (const e of entries) {
    rows.push([
      e.posted_at?.split('T')[0] || '',
      e.reference_id || '',
      e.description || e.reference_type || '',
      e.debit_amount.toLocaleString(),
      e.credit_amount.toLocaleString(),
      e.running_balance.toLocaleString(),
    ]);
  }

  const closingBalance = entries[entries.length - 1].running_balance;
  const now = Date.now();
  const agingEntries = entries.filter(e => e.running_balance > 0);
  const current = agingEntries.filter(e => (now - new Date(e.posted_at).getTime()) / (1000 * 60 * 60 * 24) <= 30).reduce((s, e) => s + e.running_balance, 0);
  const d30 = agingEntries.filter(e => { const d = (now - new Date(e.posted_at).getTime()) / (1000 * 60 * 60 * 24); return d > 30 && d <= 60; }).reduce((s, e) => s + e.running_balance, 0);
  const d60 = agingEntries.filter(e => { const d = (now - new Date(e.posted_at).getTime()) / (1000 * 60 * 60 * 24); return d > 60 && d <= 90; }).reduce((s, e) => s + e.running_balance, 0);
  const d90 = agingEntries.filter(e => { const d = (now - new Date(e.posted_at).getTime()) / (1000 * 60 * 60 * 24); return d > 90; }).reduce((s, e) => s + e.running_balance, 0);

  rows.push(['', '', '', '', '', '']);
  rows.push(['', '', 'CLOSING BALANCE', '', '', closingBalance.toLocaleString()]);
  rows.push(['', '', '', '', '', '']);
  rows.push(['', '', 'AGING: Current', '', '', current.toLocaleString()]);
  rows.push(['', '', '30 Days', '', '', d30.toLocaleString()]);
  rows.push(['', '', '60 Days', '', '', d60.toLocaleString()]);
  rows.push(['', '', '90+ Days', '', '', d90.toLocaleString()]);

  return { headers: ['Date', 'Reference', 'Description', 'Debit', 'Credit', 'Balance'], rows, totals: [] };
}
