import { supabase } from '@/lib/supabase';

export interface ScheduledObligation {
  id: string; description: string; expected_amount: number;
  expected_date: string; priority: 'critical' | 'important' | 'flexible';
  category: string; recurrence: string;
  avg_12m?: number; highest_12m?: number; lowest_12m?: number;
  last_amount?: number; last_date?: string;
}

export interface CashForecast {
  date: string; opening_balance: number; expected_inflows: number;
  expected_outflows: number; closing_balance: number;
  events: Array<{ description: string; amount: number; type: 'inflow' | 'outflow'; priority: string }>;
}

export interface TreasuryHealth {
  score: number; status: 'green' | 'amber' | 'red';
  factors: { liquidity_ratio: number; collection_rate: number; critical_coverage: number; forecast_stability: number };
  recommendations: string[]; alerts: string[];
}

export const treasuryIntelligence = {
  async getObligations(entityId: string): Promise<ScheduledObligation[]> {
    const { data } = await supabase.from('treasury_obligations').select('*').eq('entity_id', entityId).eq('is_active', true).order('expected_date');
    return (data || []).map((o: any) => ({
      id: o.id, description: o.description, expected_amount: o.expected_amount,
      expected_date: o.expected_date, priority: o.priority, category: o.category,
      recurrence: o.recurrence, avg_12m: o.avg_12m, highest_12m: o.highest_12m,
      lowest_12m: o.lowest_12m, last_amount: o.last_amount, last_date: o.last_date,
    }));
  },

  async learnPatterns(entityId: string): Promise<void> {
    const { data: obligations } = await supabase.from('treasury_obligations').select('*').eq('entity_id', entityId).eq('is_active', true);
    const { data: invoices } = await supabase.from('supplier_invoices_new').select('supplier_id, total_amount, invoice_date').eq('entity_id', entityId).order('invoice_date', { ascending: false }).limit(100);
    
    for (const obl of (obligations || [])) {
      const related = (invoices || []).filter((i: any) => {
        const desc = (obl.description || '').toLowerCase();
        return desc.includes('bond') || desc.includes('insurance') || desc.includes('municipal');
      }).slice(0, 12);
      
      if (related.length >= 3) {
        const amounts = related.map((r: any) => r.total_amount);
        const avg = amounts.reduce((s: number, a: number) => s + a, 0) / amounts.length;
        await supabase.from('treasury_obligations').update({
          avg_12m: Math.round(avg), highest_12m: Math.max(...amounts),
          lowest_12m: Math.min(...amounts), last_amount: amounts[0],
          last_date: related[0].invoice_date, updated_at: new Date().toISOString(),
        }).eq('id', obl.id);
      }
    }
  },

  async getCashForecast(entityId: string, days: number = 30): Promise<CashForecast[]> {
    const today = new Date(); const forecasts: CashForecast[] = [];
    const { data: bankAccounts } = await supabase.from('bank_accounts').select('current_balance').eq('entity_id', entityId).eq('is_active', true);
    let balance = (bankAccounts || []).reduce((s: number, b: any) => s + (b.current_balance || 0), 0);
    const obligations = await this.getObligations(entityId);

    // Get actual collection patterns from leases
    const { data: leases } = await supabase.from('leases').select('monthly_rental, billing_day').eq('lease_status', 'Active').eq('owner_entity_id', entityId);
    
    for (let d = 0; d < days; d++) {
      const date = new Date(today.getTime() + d * 86400000); const dateStr = date.toISOString().split('T')[0];
      const openingBalance = balance;
      
      // Collections on billing days (1st, 7th, 15th, 25th) not daily
      const dayOfMonth = date.getDate();
      const isCollectionDay = [1, 7, 15, 25].includes(dayOfMonth);
      const expectedInflows = isCollectionDay ? (leases || []).reduce((s: number, l: any) => s + (l.monthly_rental || 0), 0) : 0;

      const dueToday = obligations.filter(o => o.expected_date === dateStr);
      const expectedOutflows = dueToday.reduce((s: number, o: any) => s + o.expected_amount, 0);
      
      balance = openingBalance + expectedInflows - expectedOutflows;
      forecasts.push({ date: dateStr, opening_balance: openingBalance, expected_inflows: expectedInflows, expected_outflows: expectedOutflows, closing_balance: balance, events: dueToday.map(o => ({ description: o.description, amount: o.expected_amount, type: 'outflow' as const, priority: o.priority })) });
    }
    return forecasts;
  },

  async getTreasuryHealth(entityId: string): Promise<TreasuryHealth> {
    const [obligations, forecast, { data: bankAccounts }] = await Promise.all([this.getObligations(entityId), this.getCashForecast(entityId, 30), supabase.from('bank_accounts').select('current_balance').eq('entity_id', entityId).eq('is_active', true)]);
    const cash = (bankAccounts || []).reduce((s: number, b: any) => s + (b.current_balance || 0), 0);
    const upcoming = obligations.filter(o => new Date(o.expected_date) <= new Date(Date.now() + 7 * 86400000)).reduce((s: number, o: any) => s + o.expected_amount, 0);
    const liquidityRatio = upcoming > 0 ? Math.min(100, Math.round((cash / upcoming) * 100)) : 100;
    
    const { data: leases } = await supabase.from('leases').select('monthly_rental').eq('lease_status', 'Active').eq('owner_entity_id', entityId);
    const totalRental = (leases || []).reduce((s: number, l: any) => s + (l.monthly_rental || 0), 0);
    const { data: overdue } = await supabase.from('sub_ledger_entries').select('running_balance').eq('entity_id', entityId).eq('ledger_type', 'tenant').gt('running_balance', 0).order('posted_at', { ascending: false }).limit(1);
    const outstanding = overdue?.length ? overdue[0].running_balance : 0;
    const collectionRate = totalRental > 0 ? Math.round((1 - outstanding / totalRental) * 100) : 100;

    let shortfallDays = 0;
    for (const f of forecast) { if (f.closing_balance < 0) shortfallDays++; }
    const forecastStability = Math.max(0, 100 - shortfallDays * 3);

    const criticalCoverage = obligations.filter(o => o.priority === 'critical' && new Date(o.expected_date) <= new Date(Date.now() + 7 * 86400000)).length === 0 ? 100 : 50;
    const score = Math.round((liquidityRatio * 0.35 + collectionRate * 0.25 + criticalCoverage * 0.2 + forecastStability * 0.2));
    const status = score >= 80 ? 'green' : score >= 50 ? 'amber' : 'red';

    const alerts: string[] = []; const recommendations: string[] = [];
    if (liquidityRatio < 80) alerts.push(`Liquidity ratio at ${liquidityRatio}%`);
    if (collectionRate < 80) { alerts.push(`Collections at ${collectionRate}%`); recommendations.push(`R${outstanding.toLocaleString()} outstanding — initiate collections`); }
    if (shortfallDays > 0) { alerts.push(`${shortfallDays} days of forecast shortfall`); recommendations.push('Review and delay non-critical payment batches'); }

    return { score, status, factors: { liquidity_ratio: liquidityRatio, collection_rate: collectionRate, critical_coverage: criticalCoverage, forecast_stability: forecastStability }, recommendations, alerts };
  }
};
