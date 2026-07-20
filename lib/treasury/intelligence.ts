import { supabase } from '@/lib/supabase';

export interface ScheduledObligation {
  id: string; description: string; expected_amount: number;
  expected_date: string; priority: 'critical' | 'important' | 'flexible';
  category: string; property_id?: string; bank_account_id?: string;
  recurrence: 'monthly' | 'quarterly' | 'annually' | 'once';
  last_amount?: number; last_date?: string;
}

export interface CashForecast {
  date: string; opening_balance: number; expected_inflows: number;
  expected_outflows: number; closing_balance: number;
  events: Array<{ description: string; amount: number; type: 'inflow' | 'outflow'; priority: string }>;
}

export interface TreasuryHealth {
  score: number; status: 'green' | 'amber' | 'red';
  factors: { upcoming_liabilities: number; cash_available: number; overdue_debtors: number; forecast_shortfall: number };
  recommendations: string[]; alerts: string[];
}

export const treasuryIntelligence = {
  async getScheduledObligations(entityId: string): Promise<ScheduledObligation[]> {
    const { data: recurring } = await supabase.from('recurring_expenses').select('*').eq('entity_id', entityId).eq('status', 'active');
    const obligations: ScheduledObligation[] = (recurring || []).map((r: any) => ({
      id: r.id, description: r.description, expected_amount: r.amount,
      expected_date: r.next_due_date || new Date().toISOString().split('T')[0],
      priority: (r.description || '').toLowerCase().includes('bond') ? 'critical' : (r.description || '').toLowerCase().includes('insurance') ? 'critical' : (r.description || '').toLowerCase().includes('municipal') ? 'critical' : 'important',
      category: r.description || 'other', property_id: r.property_id,
      recurrence: (r.frequency as any) || 'monthly', last_amount: r.amount,
    }));
    const { data: requests } = await supabase.from('payment_requests').select('*, supplier:supplier_id(supplier_name)').eq('entity_id', entityId).eq('status', 'approved');
    for (const req of (requests || [])) {
      obligations.push({ id: req.id, description: (req as any).supplier?.supplier_name || 'Payment', expected_amount: req.amount, expected_date: req.due_date || new Date().toISOString().split('T')[0], priority: 'important', category: 'supplier_payment', recurrence: 'once', last_amount: req.amount });
    }
    return obligations.sort((a, b) => new Date(a.expected_date).getTime() - new Date(b.expected_date).getTime());
  },

  async getCashForecast(entityId: string, days: number = 30): Promise<CashForecast[]> {
    const today = new Date(); const forecasts: CashForecast[] = [];
    const { data: bankAccounts } = await supabase.from('bank_accounts').select('current_balance').eq('entity_id', entityId).eq('is_active', true);
    let currentBalance = (bankAccounts || []).reduce((s: number, b: any) => s + (b.current_balance || 0), 0);
    const obligations = await this.getScheduledObligations(entityId);
    const { data: leases } = await supabase.from('leases').select('monthly_rental').eq('lease_status', 'Active').eq('owner_entity_id', entityId);
    const dailyRental = ((leases || []).reduce((s: number, l: any) => s + (l.monthly_rental || 0), 0)) / 30;
    for (let d = 0; d < days; d++) {
      const date = new Date(today.getTime() + d * 86400000); const dateStr = date.toISOString().split('T')[0];
      const openingBalance = currentBalance; const expectedInflows = dailyRental;
      const dueToday = obligations.filter(o => o.expected_date === dateStr);
      const expectedOutflows = dueToday.reduce((s: number, o: any) => s + o.expected_amount, 0);
      currentBalance = openingBalance + expectedInflows - expectedOutflows;
      forecasts.push({ date: dateStr, opening_balance: openingBalance, expected_inflows: expectedInflows, expected_outflows: expectedOutflows, closing_balance: currentBalance, events: dueToday.map(o => ({ description: o.description, amount: o.expected_amount, type: 'outflow' as const, priority: o.priority })) });
    }
    return forecasts;
  },

  async getTreasuryHealth(entityId: string): Promise<TreasuryHealth> {
    const [obligations, forecast, { data: bankAccounts }] = await Promise.all([this.getScheduledObligations(entityId), this.getCashForecast(entityId, 30), supabase.from('bank_accounts').select('current_balance').eq('entity_id', entityId).eq('is_active', true)]);
    const cashAvailable = (bankAccounts || []).reduce((s: number, b: any) => s + (b.current_balance || 0), 0);
    const upcomingLiabilities = obligations.filter(o => new Date(o.expected_date) <= new Date(Date.now() + 7 * 86400000)).reduce((s: number, o: any) => s + o.expected_amount, 0);
    let forecastShortfall = 0;
    for (const f of forecast) { if (f.closing_balance < 0) forecastShortfall += Math.abs(f.closing_balance); }
    const { data: overdue } = await supabase.from('sub_ledger_entries').select('running_balance').eq('entity_id', entityId).eq('ledger_type', 'tenant').gt('running_balance', 0).order('posted_at', { ascending: false }).limit(1);
    const overdueDebtors = overdue?.length ? overdue[0].running_balance : 0;
    const ratio = cashAvailable / (upcomingLiabilities || 1);
    const score = Math.min(100, Math.round(ratio * 50 + (forecastShortfall === 0 ? 50 : 0)));
    const status: TreasuryHealth['status'] = score >= 80 ? 'green' : score >= 50 ? 'amber' : 'red';
    const alerts: string[] = []; const recommendations: string[] = [];
    const criticalDue = obligations.filter(o => o.priority === 'critical' && new Date(o.expected_date) <= new Date(Date.now() + 5 * 86400000));
    for (const c of criticalDue) { alerts.push(`${c.description} due in ${Math.ceil((new Date(c.expected_date).getTime() - Date.now()) / 86400000)} days — R${c.expected_amount.toLocaleString()}`); }
    if (forecastShortfall > 0) { alerts.push(`Cash shortfall of R${forecastShortfall.toLocaleString()} forecast within 30 days`); recommendations.push('Delay non-critical payment batches'); if (overdueDebtors > 0) recommendations.push(`Collect overdue tenant debt — R${overdueDebtors.toLocaleString()} outstanding`); recommendations.push('Review upcoming obligations and prioritize critical payments'); }
    return { score, status, factors: { upcoming_liabilities: upcomingLiabilities, cash_available: cashAvailable, overdue_debtors: overdueDebtors, forecast_shortfall: forecastShortfall }, recommendations, alerts };
  }
};
