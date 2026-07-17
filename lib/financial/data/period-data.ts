// lib/financial/data/period-data.ts
import { supabase } from '@/lib/supabase';

export interface PeriodSummary {
  id: string;
  period_name: string;
  status: string;
  start_date: string;
  end_date: string;
}

export const periodData = {
  async list(entityId: string, limit = 12): Promise<PeriodSummary[]> {
    const { data } = await supabase
      .from('financial_periods')
      .select('id, period_name, status, start_date, end_date')
      .eq('entity_id', entityId)
      .eq('period_type', 'financial')
      .order('end_date', { ascending: false })
      .limit(limit);
    return data || [];
  }
};
