// lib/reporting/providers/general-ledger.ts
import { supabase } from '@/lib/supabase';

export async function getGeneralLedgerData(entityId: string, periodId: string) {
  const { data: entries } = await supabase
    .from('general_ledger')
    .select('account_id, debit_amount, credit_amount, posted_at, journal_line_id, chart_of_accounts!inner(account_name, gl_code), journal_lines!inner(description, journal_id)')
    .eq('entity_id', entityId)
    .eq('period_id', periodId)
    .order('posted_at', { ascending: true });

  // Fetch ALL journals in one query — no N+1
  const journalIds = [...new Set((entries || []).map(e => (e.journal_lines as any)?.journal_id).filter(Boolean))];
  const { data: allJournals } = journalIds.length > 0
    ? await supabase.from('journals').select('id, journal_number, source_event').in('id', journalIds)
    : { data: [] };
  const journalMap = new Map((allJournals || []).map(j => [j.id, j]));

  // Get opening balance from previous closed period snapshot — not latest
  const { data: currentPeriod } = await supabase.from('financial_periods').select('period_start').eq('id', periodId).single();
  const { data: prevClosed } = await supabase
    .from('financial_periods')
    .select('id')
    .eq('entity_id', entityId)
    .eq('period_type', 'financial')
    .eq('status', 'closed')
    .lt('period_end', currentPeriod?.period_start || new Date().toISOString())
    .order('period_end', { ascending: false })
    .limit(1)
    .single();

  const openingMap = new Map<string, number>();
  if (prevClosed) {
    const { data: snapshot } = await supabase
      .from('financial_statements')
      .select('statement_data')
      .eq('entity_id', entityId)
      .eq('period_id', prevClosed.id)
      .eq('statement_type', 'trial_balance')
      .single();
    if (snapshot?.statement_data?.rows) {
      for (const row of snapshot.statement_data.rows) {
        openingMap.set(row.account_id, row.net_balance || 0);
      }
    }
  }

  // Group by account with running balance
  const accountEntries = new Map<string, { gl: string; name: string; entries: any[] }>();
  for (const e of (entries || [])) {
    const acc = e.chart_of_accounts as any;
    if (!acc) continue;
    const key = e.account_id;
    if (!accountEntries.has(key)) accountEntries.set(key, { gl: acc.gl_code, name: acc.account_name, entries: [] });
    accountEntries.get(key)!.entries.push(e);
  }

  const rows: string[][] = [];
  for (const [accountId, data] of accountEntries) {
    const opening = openingMap.get(accountId) || 0;
    let running = opening;
    if (opening !== 0) rows.push(['', data.gl, data.name, 'Opening Balance', '', '', '', opening.toLocaleString()]);
    for (const e of data.entries) {
      const line = e.journal_lines as any;
      const journal = journalMap.get(line?.journal_id);
      const dr = e.debit_amount || 0;
      const cr = e.credit_amount || 0;
      running += dr - cr;
      rows.push([e.posted_at?.split('T')[0] || '', data.gl, data.name, line?.description || '', journal?.journal_number || '', dr.toLocaleString(), cr.toLocaleString(), running.toLocaleString()]);
    }
  }

  return { headers: ['Date', 'Code', 'Account', 'Description', 'Journal', 'Debit', 'Credit', 'Balance'], rows, totals: [] };
}
