// lib/financial/recoveries-engine.ts
// Recoveries Engine — Budget, actual, recovery calculation, true-up

import { supabase } from '@/lib/supabase';
import { publish } from '../platform/events/event-bus';
import type { Recovery, RecoveryCalculation } from './types';

export class RecoveriesEngine {
  async setBudget(entityId: string, propertyId: string, category: string, periodId: string, budgetedAmount: number): Promise<Recovery> {
    const { data, error } = await supabase.from('recoveries').upsert({
      entity_id: entityId, property_id: propertyId, recovery_category: category,
      period_id: periodId, budgeted_amount: budgetedAmount, status: 'budgeted',
    }, { onConflict: 'entity_id,property_id,recovery_category,period_id' }).select('*').single();

    if (error) throw error;
    return data as Recovery;
  }

  async recordExpense(recoveryId: string, actualExpense: number): Promise<Recovery> {
    const { data, error } = await supabase.from('recoveries').update({
      actual_expense: actualExpense, status: 'expense_recorded',
      updated_at: new Date().toISOString(),
    }).eq('id', recoveryId).select('*').single();

    if (error) throw error;
    return data as Recovery;
  }

  async calculateRecovery(params: RecoveryCalculation): Promise<number> {
    const calculated = Math.round(params.actual_expense * (params.tenant_share_pct / 100) * 100) / 100;
    const recoveryRate = params.actual_expense > 0 ? Math.round((calculated / params.actual_expense) * 100) : 0;

    await supabase.from('recoveries').update({
      recovered_amount: calculated, recovery_rate: recoveryRate, status: 'calculated',
      updated_at: new Date().toISOString(),
    }).eq('property_id', params.property_id).eq('recovery_category', params.category).eq('period_id', params.period_id);

    if (recoveryRate < 90) {
      await publish('recovery.under_recovery', {
        correlationId: crypto.randomUUID(), source: 'recoveries-engine', version: '1.0',
        payload: { property_id: params.property_id, category: params.category, recovery_rate: recoveryRate },
      });
    }

    return calculated;
  }

  async getStatus(entityId: string, propertyId: string, periodId: string): Promise<Recovery[]> {
    const { data } = await supabase.from('recoveries').select('*').eq('entity_id', entityId).eq('property_id', propertyId).eq('period_id', periodId);
    return (data || []) as Recovery[];
  }

  async performTrueUp(entityId: string, propertyId: string, leaseId: string, periodId: string): Promise<void> {
    const recoveries = await this.getStatus(entityId, propertyId, periodId);
    let totalExpense = 0, totalRecovered = 0;
    for (const r of recoveries) { totalExpense += r.actual_expense; totalRecovered += r.recovered_amount; }

    const difference = totalExpense - totalRecovered;
    if (Math.abs(difference) > 1) {
      await publish('recovery.true_up.required', {
        correlationId: crypto.randomUUID(), source: 'recoveries-engine', version: '1.0',
        payload: { entityId, propertyId, leaseId, periodId, difference, totalExpense, totalRecovered },
      });
    }

    await supabase.from('recoveries').update({
      true_up_status: difference > 1 ? 'under_recovery' : difference < -1 ? 'over_recovery' : 'balanced',
      updated_at: new Date().toISOString(),
    }).eq('entity_id', entityId).eq('property_id', propertyId).eq('period_id', periodId);
  }
}

export const recoveriesEngine = new RecoveriesEngine();
