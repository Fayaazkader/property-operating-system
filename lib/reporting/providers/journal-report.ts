// lib/reporting/providers/journal-report.ts
import { supabase } from '@/lib/supabase';

export async function getJournalReportData(entityId: string, periodId: string) {
  // Single query: journals + line totals via left join
  const { data: journals } = await supabase
    .from('journals')
    .select('id, journal_number, journal_type, description, source_event, is_posted, posted_at, created_at')
    .eq('entity_id', entityId)
    .eq('period_id', periodId)
    .order('created_at', { ascending: false });

  if (!journals?.length) {
    return { headers: ['Number', 'Type', 'Description', 'Status', 'Date', 'Debit', 'Credit'], rows: [], totals: [] };
  }

  // Single query for ALL line totals
  const journalIds = journals.map(j => j.id);
  const { data: allLines } = await supabase
    .from('journal_lines')
    .select('journal_id, debit_amount, credit_amount')
    .in('journal_id', journalIds);

  // Group in memory
  const totalsMap = new Map<string, { dr: number; cr: number }>();
  for (const l of (allLines || [])) {
    if (!totalsMap.has(l.journal_id)) totalsMap.set(l.journal_id, { dr: 0, cr: 0 });
    const t = totalsMap.get(l.journal_id)!;
    t.dr += l.debit_amount || 0;
    t.cr += l.credit_amount || 0;
  }

  const rows = journals.map(j => {
    const t = totalsMap.get(j.id) || { dr: 0, cr: 0 };
    return [j.journal_number, j.journal_type?.replace(/_/g, ' ') || '', j.description || '', j.is_posted ? 'Posted' : 'Pending', j.posted_at?.split('T')[0] || '', t.dr.toLocaleString(), t.cr.toLocaleString()];
  });

  return { headers: ['Number', 'Type', 'Description', 'Status', 'Date', 'Debit', 'Credit'], rows, totals: [] };
}
