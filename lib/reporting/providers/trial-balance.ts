// lib/reporting/providers/trial-balance.ts
import { supabase } from '@/lib/supabase';

export interface TrialBalanceRow {
  gl_code: string;
  account_name: string;
  account_type: string;
  debit: number;
  credit: number;
}

export async function getTrialBalanceData(entityId: string, periodId: string): Promise<{ headers: string[]; rows: string[][]; totals: string[] }> {
  const { data: lines } = await supabase
    .from('general_ledger')
    .select('account_id, debit_amount, credit_amount, chart_of_accounts!inner(account_name, gl_code, account_type)')
    .eq('entity_id', entityId)
    .eq('period_id', periodId);

  const map = new Map<string, { name: string; gl: string; type: string; dr: number; cr: number }>();
  for (const l of (lines || [])) {
    const acc = l.chart_of_accounts as any;
    if (!acc) continue;
    const key = l.account_id;
    if (!map.has(key)) map.set(key, { name: acc.account_name, gl: acc.gl_code, type: acc.account_type, dr: 0, cr: 0 });
    const e = map.get(key)!;
    e.dr += l.debit_amount || 0;
    e.cr += l.credit_amount || 0;
  }

  const sorted = Array.from(map.values()).sort((a, b) => a.gl.localeCompare(b.gl));
  const totalDr = sorted.reduce((s, r) => s + r.dr, 0);
  const totalCr = sorted.reduce((s, r) => s + r.cr, 0);

  return {
    headers: ['GL Code', 'Account', 'Type', 'Debit', 'Credit'],
    rows: sorted.map(r => [r.gl, r.name, r.type, r.dr.toLocaleString(), r.cr.toLocaleString()]),
    totals: ['', '', 'TOTAL', totalDr.toLocaleString(), totalCr.toLocaleString()],
  };
}
