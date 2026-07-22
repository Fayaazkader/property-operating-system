// lib/reporting/providers/cash-flow.ts
import { supabase } from '@/lib/supabase';

export async function getCashFlowData(entityId: string, periodId: string) {
  // Get bank accounts with their cash flow category from COA
  const { data: bankAccounts } = await supabase
    .from('chart_of_accounts')
    .select('id, account_name')
    .eq('entity_id', entityId)
    .eq('account_type', 'asset')
    .ilike('account_name', '%bank%');

  if (!bankAccounts?.length) {
    return { headers: ['Category', 'Description', 'Amount'], rows: [['', 'No bank accounts found', '']], totals: [] };
  }

  const bankIds = bankAccounts.map(b => b.id);
  const { data: lines } = await supabase
    .from('journal_lines')
    .select('debit_amount, credit_amount, description, journals!inner(source_event, period_id)')
    .in('account_id', bankIds)
    .eq('journals.period_id', periodId);

  // Classify by source_event categories — but grouped properly
  const operating: string[][] = [];
  const investing: string[][] = [];
  const financing: string[][] = [];

  for (const l of (lines || [])) {
    const event = (l.journals as any)?.source_event || '';
    const amount = (l.debit_amount || 0) - (l.credit_amount || 0);
    const desc = l.description || event;

    // Operating: day-to-day business
    if (event.includes('rental') || event.includes('receipt') || event.includes('supplier_payment') || event.includes('bank_charge') || event.includes('interest') || event.includes('commission_paid') || event.includes('recovery') || event.includes('penalty')) {
      operating.push([desc, amount.toLocaleString()]);
    }
    // Investing: long-term assets
    else if (event.includes('asset') || event.includes('deposit_received') || event.includes('deposit_refunded')) {
      investing.push([desc, amount.toLocaleString()]);
    }
    // Financing: loans, equity
    else if (event.includes('loan') || event.includes('capital') || event.includes('dividend')) {
      financing.push([desc, amount.toLocaleString()]);
    }
    // Default to operating
    else {
      operating.push([desc, amount.toLocaleString()]);
    }
  }

  const netCash = (lines || []).reduce((s, l) => s + (l.debit_amount || 0) - (l.credit_amount || 0), 0);
  const opTotal = operating.reduce((s, r) => s + parseFloat(r[1].replace(/,/g, '')) || 0, 0);

  const rows: string[][] = [
    ['OPERATING ACTIVITIES', ''],
    ...operating.map(r => [r[0], r[1]]),
    ['', ''],
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
