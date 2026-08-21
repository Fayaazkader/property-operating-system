// lib/financial/data/ledger-data.ts
// Raw ledger queries only. No aggregation. No business logic.

import { supabase } from '@/lib/supabase';

export interface RawLedgerEntry {
  account_id: string;
  account_name: string;
  gl_code: string;
  account_type: string;
  debit_amount: number;
  credit_amount: number;
}

export const ledgerData = {
  async getEntries(entityId: string, periodId: string): Promise<RawLedgerEntry[]> {
    const { data } = await supabase
      .from('general_ledger')
      .select('account_id, debit_amount, credit_amount, chart_of_accounts!inner(account_name, gl_code, account_type)')
      .eq('entity_id', entityId)
      .eq('period_id', periodId);

    return (data || []).map(line => ({
      account_id: line.account_id,
      account_name: (line.chart_of_accounts as any)?.account_name || 'Unknown',
      gl_code: (line.chart_of_accounts as any)?.gl_code ?? '',
      account_type: (line.chart_of_accounts as any)?.account_type || 'expense',
      debit_amount: line.debit_amount || 0,
      credit_amount: line.credit_amount || 0,
    }));
  }
};
