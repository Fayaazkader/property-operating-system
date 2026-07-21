// lib/financial/tb-status-service.ts
// Financial domain — Trial Balance status for governance consumers

import { supabase } from '@/lib/supabase';

export interface TrialBalanceStatus {
  balanced: boolean;
  totalDebits: number;
  totalCredits: number;
}

export const tbStatusService = {
  async getStatus(entityId: string): Promise<TrialBalanceStatus> {
    const { data } = await supabase.from('general_ledger').select('debit_amount, credit_amount').eq('entity_id', entityId);
    const totalDr = (data || []).reduce((s: number, e: any) => s + (e.debit_amount || 0), 0);
    const totalCr = (data || []).reduce((s: number, e: any) => s + (e.credit_amount || 0), 0);
    return { balanced: Math.abs(totalDr - totalCr) < 0.01, totalDebits: totalDr, totalCredits: totalCr };
  }
};
