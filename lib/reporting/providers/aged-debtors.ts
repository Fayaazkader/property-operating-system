// lib/reporting/providers/aged-debtors.ts
import { supabase } from '@/lib/supabase';

export async function getAgedDebtorsData(entityId: string): Promise<{ headers: string[]; rows: string[][]; totals: string[] }> {
  const { data: entries } = await supabase
    .from('sub_ledger_entries')
    .select('tenant_id, running_balance, posted_at')
    .eq('entity_id', entityId)
    .eq('ledger_type', 'tenant')
    .gt('running_balance', 0)
    .order('posted_at', { ascending: false });

  const tenantBalances = new Map<string, { balance: number; oldestDate: string }>();
  for (const e of (entries || [])) {
    if (!tenantBalances.has(e.tenant_id)) {
      tenantBalances.set(e.tenant_id, { balance: e.running_balance, oldestDate: e.posted_at });
    }
  }

  const now = Date.now();
  const rows: string[][] = [];
  let totalCurrent = 0, total30 = 0, total60 = 0, total90 = 0, total120 = 0;

  for (const [tenantId, data] of tenantBalances) {
    const { data: tenant } = await supabase.from('tenants').select('tenant_name').eq('id', tenantId).single();
    const daysOld = Math.floor((now - new Date(data.oldestDate).getTime()) / (1000 * 60 * 60 * 24));
    const current = daysOld <= 30 ? data.balance : 0;
    const d30 = daysOld > 30 && daysOld <= 60 ? data.balance : 0;
    const d60 = daysOld > 60 && daysOld <= 90 ? data.balance : 0;
    const d90 = daysOld > 90 && daysOld <= 120 ? data.balance : 0;
    const d120 = daysOld > 120 ? data.balance : 0;
    totalCurrent += current; total30 += d30; total60 += d60; total90 += d90; total120 += d120;
    rows.push([tenant?.tenant_name || 'Unknown', current.toLocaleString(), d30.toLocaleString(), d60.toLocaleString(), d90.toLocaleString(), d120.toLocaleString(), data.balance.toLocaleString()]);
  }

  return {
    headers: ['Tenant', 'Current', '30 Days', '60 Days', '90 Days', '120+ Days', 'Total'],
    rows,
    totals: ['TOTAL', totalCurrent.toLocaleString(), total30.toLocaleString(), total60.toLocaleString(), total90.toLocaleString(), total120.toLocaleString(), (totalCurrent + total30 + total60 + total90 + total120).toLocaleString()],
  };
}
