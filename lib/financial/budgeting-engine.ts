// lib/financial/budgeting-engine.ts
// Budgeting Engine — Budget vs Actual with hierarchy support

import { supabase } from '@/lib/supabase';
import { financialStatementsEngine } from './statements-engine';
import type { Budget, BudgetVsActual } from './types';

export class BudgetingEngine {
  async setBudget(entityId: string, periodId: string, accountId: string, amount: number, propertyId?: string, costCentre?: string): Promise<Budget> {
    const { data, error } = await supabase.from('budgets').upsert({
      entity_id: entityId, period_id: periodId, account_id: accountId,
      budgeted_amount: amount, property_id: propertyId || null, cost_centre: costCentre || null,
    }, { onConflict: 'entity_id,period_id,account_id,COALESCE(property_id, \'00000000-0000-0000-0000-000000000000\'),COALESCE(cost_centre, \'\')' }).select('*').single();

    if (error) throw error;
    return data as Budget;
  }

  async getBudgetVsActual(entityId: string, periodId: string, propertyId?: string): Promise<BudgetVsActual[]> {
    const tb = await financialStatementsEngine.generateTrialBalance(entityId, periodId);
    let query = supabase.from('budgets').select('*').eq('entity_id', entityId).eq('period_id', periodId);
    if (propertyId) query = query.eq('property_id', propertyId);

    const { data: budgets } = await query;
    const budgetMap = new Map<string, number>();
    for (const b of (budgets || [])) { budgetMap.set(b.account_id, b.budgeted_amount); }

    return tb.filter(l => l.account_type === 'income' || l.account_type === 'expense').map(l => {
      const budgeted = budgetMap.get(l.account_id) || 0;
      const actual = Math.abs(l.net_balance);
      const variance = actual - budgeted;
      return {
        account_id: l.account_id, account_name: l.account_name, gl_code: l.gl_code,
        budgeted, actual, variance,
        variance_pct: budgeted > 0 ? Math.round((variance / budgeted) * 100) : 0,
      };
    });
  }

  async importBudgets(entityId: string, periodId: string, items: Array<{ account_id: string; amount: number; property_id?: string; cost_centre?: string }>): Promise<void> {
    for (const item of items) {
      await this.setBudget(entityId, periodId, item.account_id, item.amount, item.property_id, item.cost_centre);
    }
  }
}

export const budgetingEngine = new BudgetingEngine();
