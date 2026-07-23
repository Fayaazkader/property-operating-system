// lib/reporting/providers/recovery-analysis.ts
import { supabase } from '@/lib/supabase';

export async function getRecoveryAnalysisData(entityId: string, periodId?: string) {
  let query = supabase.from('recoveries').select('*').eq('entity_id', entityId);
  if (periodId) query = query.eq('period_id', periodId);
  const { data: recoveries } = await query.order('property_id');

  if (!recoveries?.length) return { headers: ['Property', 'Category', 'Budgeted', 'Actual', 'Recovered', 'Rate', 'Variance', 'Unrecovered', 'True-up'], rows: [], totals: [] };

  const { data: properties } = await supabase.from('properties').select('id, property_name').eq('entity_id', entityId);
  const propMap = new Map((properties || []).map(p => [p.id, p.property_name]));

  const rows = recoveries.map(r => {
    const variance = r.recovered_amount - r.budgeted_amount;
    const unrecovered = r.actual_expense - r.recovered_amount;
    return [
      propMap.get(r.property_id) || 'Unknown',
      r.recovery_category?.replace(/_/g, ' ') || '',
      r.budgeted_amount.toLocaleString(),
      r.actual_expense.toLocaleString(),
      r.recovered_amount.toLocaleString(),
      `${r.recovery_rate || 0}%`,
      variance.toLocaleString(),
      unrecovered > 0 ? unrecovered.toLocaleString() : '0',
      r.true_up_status || r.status || '',
    ];
  });

  const totalBudgeted = recoveries.reduce((s, r) => s + r.budgeted_amount, 0);
  const totalActual = recoveries.reduce((s, r) => s + r.actual_expense, 0);
  const totalRecovered = recoveries.reduce((s, r) => s + r.recovered_amount, 0);
  const totalVariance = totalRecovered - totalBudgeted;
  const totalUnrecovered = totalActual - totalRecovered;

  return {
    headers: ['Property', 'Category', 'Budgeted', 'Actual', 'Recovered', 'Rate', 'Variance', 'Unrecovered', 'True-up'],
    rows,
    totals: ['TOTAL', '', totalBudgeted.toLocaleString(), totalActual.toLocaleString(), totalRecovered.toLocaleString(), `${totalActual > 0 ? Math.round((totalRecovered / totalActual) * 100) : 0}%`, totalVariance.toLocaleString(), totalUnrecovered > 0 ? totalUnrecovered.toLocaleString() : '0', ''],
  };
}
