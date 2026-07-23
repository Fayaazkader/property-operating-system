// lib/reporting/providers/deposit-register.ts
import { supabase } from '@/lib/supabase';

export async function getDepositRegisterData(entityId: string) {
  const { data: deposits } = await supabase
    .from('deposit_register')
    .select('*')
    .eq('entity_id', entityId)
    .order('held_since', { ascending: true });

  if (!deposits?.length) {
    return { headers: ['Tenant', 'Original', 'Interest', 'Applied', 'Refunded', 'Balance', 'Status', 'Since'], rows: [], totals: [] };
  }

  // Single query for all tenant names — no N+1
  const tenantIds = [...new Set(deposits.map(d => d.tenant_id))];
  const { data: tenants } = await supabase.from('tenants').select('id, tenant_name').in('id', tenantIds);
  const tenantMap = new Map((tenants || []).map(t => [t.id, t.tenant_name]));

  const rows = deposits.map(d => [
    tenantMap.get(d.tenant_id) || 'Unknown',
    d.original_amount.toLocaleString(),
    d.interest_accrued.toLocaleString(),
    d.amount_applied.toLocaleString(),
    d.amount_refunded.toLocaleString(),
    d.current_balance.toLocaleString(),
    d.status,
    d.held_since?.split('T')[0] || '',
  ]);

  const totalHeld = deposits.reduce((s, d) => s + d.current_balance, 0);

  return {
    headers: ['Tenant', 'Original', 'Interest', 'Applied', 'Refunded', 'Balance', 'Status', 'Since'],
    rows,
    totals: ['TOTAL', '', '', '', '', totalHeld.toLocaleString(), '', ''],
  };
}
