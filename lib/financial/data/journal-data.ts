// lib/financial/data/journal-data.ts
// Raw journal queries. No business logic. No fallbacks.

import { supabase } from '@/lib/supabase';

export interface RawJournal {
  id: string;
  journal_number: string;
  journal_type: string;
  description: string;
  source_event: string;
  is_posted: boolean;
  posted_at: string;
  created_at: string;
  period_id: string;
  entity_id: string;
}

export const journalData = {
  async list(entityId: string, periodId: string, limit = 50, offset = 0): Promise<RawJournal[]> {
    const { data } = await supabase
      .from('journals')
      .select('id, journal_number, journal_type, description, source_event, is_posted, posted_at, created_at, period_id, entity_id')
      .eq('entity_id', entityId)
      .eq('period_id', periodId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    return data || [];
  },

  async count(entityId: string, periodId: string): Promise<number> {
    const { count } = await supabase
      .from('journals')
      .select('*', { count: 'exact', head: true })
      .eq('entity_id', entityId)
      .eq('period_id', periodId);
    return count || 0;
  },

  async get(journalId: string): Promise<any | null> {
    const { data } = await supabase
      .from('journals')
      .select('*, lines:journal_lines(*)')
      .eq('id', journalId)
      .single();
    return data;
  },

  async getLineTotals(journalIds: string[]): Promise<Record<string, { total_debits: number; total_credits: number; line_count: number }>> {
    if (!journalIds.length) return {};
    const { data } = await supabase
      .from('journal_lines')
      .select('journal_id, debit_amount, credit_amount')
      .in('journal_id', journalIds);

    const totals: Record<string, any> = {};
    for (const line of (data || [])) {
      if (!totals[line.journal_id]) totals[line.journal_id] = { total_debits: 0, total_credits: 0, line_count: 0 };
      totals[line.journal_id].total_debits += line.debit_amount || 0;
      totals[line.journal_id].total_credits += line.credit_amount || 0;
      totals[line.journal_id].line_count += 1;
    }
    return totals;
  }
};
