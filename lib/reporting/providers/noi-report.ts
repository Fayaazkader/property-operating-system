// lib/reporting/providers/noi-report.ts
// NOI = Operating Revenue - Operating Expenses. Classification from COA reporting_category.

import { supabase } from '@/lib/supabase';

export async function getNoiReportData(entityId: string, periodId?: string) {
  const { data: properties } = await supabase.from('properties').select('id, property_name').eq('entity_id', entityId);
  if (!properties?.length) return { headers: ['Property', 'Revenue', 'Expenses', 'NOI', 'Margin'], rows: [], totals: [] };

  const { data: coa } = await supabase
    .from('chart_of_accounts')
    .select('id, reporting_category')
    .eq('entity_id', entityId);

  const operatingRevenueIds = new Set((coa || []).filter(a => a.reporting_category === 'operating_revenue').map(a => a.id));
  const operatingExpenseIds = new Set((coa || []).filter(a => a.reporting_category === 'operating_expense').map(a => a.id));

  const { data: glEntries } = await supabase
    .from('journal_lines')
    .select('debit_amount, credit_amount, account_id, property_id, journals!inner(period_id)')
    .eq('journals.period_id', periodId || '')
    .not('property_id', 'is', null);

  const propertyRevenue = new Map<string, number>();
  const propertyExpenses = new Map<string, number>();

  for (const e of (glEntries || [])) {
    if (operatingRevenueIds.has(e.account_id)) {
      propertyRevenue.set(e.property_id, (propertyRevenue.get(e.property_id) || 0) + (e.credit_amount || 0));
    }
    if (operatingExpenseIds.has(e.account_id)) {
      propertyExpenses.set(e.property_id, (propertyExpenses.get(e.property_id) || 0) + (e.debit_amount || 0));
    }
  }

  const rows: string[][] = [];
  let totalRevenue = 0, totalExpenses = 0;

  for (const prop of properties) {
    const revenue = propertyRevenue.get(prop.id) || 0;
    const expenses = propertyExpenses.get(prop.id) || 0;
    const noi = revenue - expenses;
    const margin = revenue > 0 ? Math.round((noi / revenue) * 100) : 0;
    totalRevenue += revenue; totalExpenses += expenses;
    rows.push([prop.property_name, revenue.toLocaleString(), expenses.toLocaleString(), noi.toLocaleString(), `${margin}%`]);
  }

  const totalNoi = totalRevenue - totalExpenses;
  const totalMargin = totalRevenue > 0 ? Math.round((totalNoi / totalRevenue) * 100) : 0;

  return {
    headers: ['Property', 'Revenue', 'Expenses', 'NOI', 'Margin'],
    rows,
    totals: ['PORTFOLIO', totalRevenue.toLocaleString(), totalExpenses.toLocaleString(), totalNoi.toLocaleString(), `${totalMargin}%`],
  };
}
