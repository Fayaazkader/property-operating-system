// lib/reporting/providers/cash-flow.ts
// Cash flow classified by explicit cash_flow_category on Chart of Accounts

import { supabase } from '@/lib/supabase';

export async function getCashFlowData(entityId: string, periodId: string) {
  const { data: bankAccounts } = await supabase
    .from('chart_of_accounts')
    .select('id, account_name')
    .eq('entity_id', entityId)
    .eq('account_type', 'asset')
    .ilike('account_name', '%bank%');

  if (!bankAccounts?.length) {
    return { headers: ['Description', 'Amount'], rows: [['No bank accounts found', '']], totals: [] };
  }

  const bankIds = bankAccounts.map(b => b.id);
  const { data: lines } = await supabase
    .from('journal_lines')
    .select('debit_amount, credit_amount, description, account_id, journals!inner(source_event, period_id)')
    .in('account_id', bankIds)
    .eq('journals.period_id', periodId);

  // Get cash flow categories from COA
  const { data: coaAccounts } = await supabase
    .from('chart_of_accounts')
    .select('id, cash_flow_category')
    .eq('entity_id', entityId);

  const categoryMap = new Map<string, string>();
  (coaAccounts || []).forEach(a => categoryMap.set(a.id, a.cash_flow_category || 'operating'));

  const operating: string[][] = [];
  const investing: string[][] = [];
  const financing: string[][] = [];

  for (const l of (lines || [])) {
    const amount = (l.debit_amount || 0) - (l.credit_amount || 0);
    const desc = l.description || (l.journals as any)?.source_event || '';
    const category = categoryMap.get(l.account_id) || 'operating';

    if (category === 'investing') investing.push([desc, amount.toLocaleString()]);
    else if (category === 'financing') financing.push([desc, amount.toLocaleString()]);
    else operating.push([desc, amount.toLocaleString()]);
  }

  const netCash = (lines || []).reduce((s, l) => s + (l.debit_amount || 0) - (l.credit_amount || 0), 0);
  const opTotal = operating.reduce((s, r) => s + (parseFloat(r[1].replace(/,/g, '')) || 0), 0);

  const rows: string[][] = [
    ['OPERATING ACTIVITIES', ''],
    ...operating.map(r => [r[0], r[1]]),
    ['Net Operating Cash Flow', opTotal.toLocaleString()],
    ['', ''],
    ['INVESTING ACTIVITIES', ''],
    ...investing.map(r => [r[0], r[1]]),
    ['', ''],
    ['FINANCING ACTIVITIES', ''],
    ...financing.map(r => [r[0], r[1]]),
    ['', ''],
    ['NET CASH FLOW', netCash.toLocaleString()],
  ];

  return { headers: ['Description', 'Amount'], rows, totals: [] };
}
