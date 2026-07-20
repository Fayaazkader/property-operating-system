// lib/treasury/rules-engine.ts
// Treasury Rules Engine — Evaluates conditions and generates alerts/recommendations

import { supabase } from '@/lib/supabase';

export interface TreasuryRule {
  id: string;
  condition: string;
  alert_level: 'critical' | 'warning' | 'info';
  message_template: string;
  action: string;
  category: 'liquidity' | 'obligation' | 'collection' | 'batch';
}

export interface RuleResult {
  rule_id: string;
  triggered: boolean;
  alert_level: string;
  message: string;
  action: string;
  category: string;
  data?: any;
}

export const treasuryRulesEngine = {
  rules: [
    { id: 'bond_shortfall', condition: 'bond_due_soon && cash_insufficient', alert_level: 'critical', message_template: 'Bond payment of R{amount} due in {days} days. Projected cash: R{cash}. Shortfall: R{shortfall}.', action: 'Transfer from reserves or delay non-critical batches', category: 'obligation' },
    { id: 'supplier_batch_exceeds_cash', condition: 'batch_total > available_cash', alert_level: 'warning', message_template: 'Approved supplier payments (R{batch_total}) exceed available cash (R{cash}).', action: 'Review and prioritize critical payments', category: 'batch' },
    { id: 'collections_below_target', condition: 'collection_rate < 80', alert_level: 'warning', message_template: 'Tenant collections at {rate}% — below 80% target. R{outstanding} outstanding.', action: 'Initiate collection process for overdue tenants', category: 'collection' },
    { id: 'municipal_overdue', condition: 'municipal_unpaid_past_due', alert_level: 'critical', message_template: 'Municipal payment of R{amount} is overdue. Service interruption risk.', action: 'Prioritize municipal payment immediately', category: 'obligation' },
    { id: 'critical_obligation_approaching', condition: 'critical_due_within_5_days', alert_level: 'critical', message_template: 'Critical obligation: {description} — R{amount} due {date}.', action: 'Ensure sufficient cash available', category: 'obligation' },
    { id: 'forecast_shortfall_30d', condition: 'forecast_negative_within_30d', alert_level: 'warning', message_template: 'Cash forecast projects R{shortfall} shortfall within 30 days.', action: 'Review upcoming obligations and collections', category: 'liquidity' },
  ],

  async evaluate(entityId: string): Promise<RuleResult[]> {
    const results: RuleResult[] = [];
    
    // Get data
    const { data: bankAccounts } = await supabase.from('bank_accounts').select('current_balance').eq('entity_id', entityId).eq('is_active', true);
    const cashAvailable = (bankAccounts || []).reduce((s: number, b: any) => s + (b.current_balance || 0), 0);

    const { data: obligations } = await supabase.from('recurring_expenses').select('*').eq('entity_id', entityId).eq('status', 'active');
    
    const { data: requests } = await supabase.from('payment_requests').select('*, supplier:supplier_id(supplier_name)').eq('entity_id', entityId).eq('status', 'approved');
    const batchTotal = (requests || []).reduce((s: number, r: any) => s + r.amount, 0);

    const { data: overdue } = await supabase.from('sub_ledger_entries').select('running_balance').eq('entity_id', entityId).eq('ledger_type', 'tenant').gt('running_balance', 0).order('posted_at', { ascending: false }).limit(1);
    const outstanding = overdue?.length ? overdue[0].running_balance : 0;

    const { data: leases } = await supabase.from('leases').select('monthly_rental').eq('lease_status', 'Active').eq('owner_entity_id', entityId);
    const totalRental = (leases || []).reduce((s: number, l: any) => s + (l.monthly_rental || 0), 0);

    // Evaluate each rule
    for (const rule of this.rules) {
      let triggered = false;
      let data: any = {};

      switch (rule.id) {
        case 'bond_shortfall': {
          const bond = (obligations || []).find((o: any) => (o.description || '').toLowerCase().includes('bond'));
          if (bond) {
            const days = Math.ceil((new Date(bond.next_due_date || bond.created_at).getTime() - Date.now()) / 86400000);
            if (days <= 5 && cashAvailable < bond.amount) {
              triggered = true;
              data = { amount: bond.amount.toLocaleString(), days, cash: cashAvailable.toLocaleString(), shortfall: (bond.amount - cashAvailable).toLocaleString() };
            }
          }
          break;
        }
        case 'supplier_batch_exceeds_cash':
          if (batchTotal > cashAvailable && batchTotal > 0) {
            triggered = true;
            data = { batch_total: batchTotal.toLocaleString(), cash: cashAvailable.toLocaleString() };
          }
          break;
        case 'collections_below_target': {
          const rate = totalRental > 0 ? Math.round((1 - outstanding / totalRental) * 100) : 100;
          if (rate < 80) {
            triggered = true;
            data = { rate, outstanding: outstanding.toLocaleString() };
          }
          break;
        }
        case 'municipal_overdue': {
          const municipal = (obligations || []).find((o: any) => (o.description || '').toLowerCase().includes('municipal'));
          if (municipal && new Date(municipal.next_due_date || municipal.created_at) < new Date()) {
            triggered = true;
            data = { amount: municipal.amount.toLocaleString() };
          }
          break;
        }
        case 'critical_obligation_approaching': {
          const critical = (obligations || []).filter((o: any) => {
            const desc = (o.description || '').toLowerCase();
            return (desc.includes('bond') || desc.includes('insurance') || desc.includes('municipal')) && new Date(o.next_due_date || o.created_at) <= new Date(Date.now() + 5 * 86400000);
          });
          if (critical.length > 0) {
            triggered = true;
            data = { description: critical[0].description, amount: (critical[0] as any).amount.toLocaleString(), date: (critical[0] as any).next_due_date };
          }
          break;
        }
        case 'forecast_shortfall_30d': {
          let shortfall = 0;
          let bal = cashAvailable;
          for (let d = 0; d < 30; d++) {
            const due = (obligations || []).filter((o: any) => o.next_due_date === new Date(Date.now() + d * 86400000).toISOString().split('T')[0]);
            bal -= due.reduce((s: number, o: any) => s + o.amount, 0);
            if (bal < 0) shortfall += Math.abs(bal);
          }
          if (shortfall > 0) {
            triggered = true;
            data = { shortfall: shortfall.toLocaleString() };
          }
          break;
        }
      }

      if (triggered) {
        let message = rule.message_template;
        for (const [key, val] of Object.entries(data)) {
          message = message.replace(`{${key}}`, String(val));
        }
        results.push({ rule_id: rule.id, triggered, alert_level: rule.alert_level, message, action: rule.action, category: rule.category, data });
      }
    }

    return results;
  }
};
