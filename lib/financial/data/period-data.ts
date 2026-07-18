// lib/financial/data/period-data.ts
import { supabase } from '@/lib/supabase';

export interface PeriodSummary {
  id: string;
  period_name: string;
  status: string;
  period_start: string;
  period_end: string;
}

export const periodData = {
  async list(entityId: string, limit = 12): Promise<PeriodSummary[]> {
    const { data } = await supabase
      .from('financial_periods')
      .select('id, period_name, status, period_start, period_end')
      .eq('entity_id', entityId)
      .eq('period_type', 'financial')
      .order('period_end', { ascending: false })
      .limit(limit);
    return data || [];
  }
};
