// lib/financial/rules-engine.ts
// Financial Rules Engine — Central financial decision engine

import { supabase } from '@/lib/supabase';
import { formulaEngine } from './formula-engine';
import type { PostingTemplate, FinancialEvent, VatCategory } from './types';

export class FinancialRulesEngine {
  async resolveTemplate(entityId: string, businessEvent: string): Promise<PostingTemplate | null> {
    const { data: template } = await supabase
      .from('posting_templates')
      .select('*, lines:posting_template_lines(*)')
      .eq('entity_id', entityId)
      .eq('business_event', businessEvent)
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .limit(1)
      .single();

    return template as PostingTemplate || null;
  }

  async resolveAccountId(entityId: string, resolver: string): Promise<string | null> {
    const { data: byGlCode } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('entity_id', entityId)
      .eq('gl_code', resolver)
      .single();

    if (byGlCode) return byGlCode.id;

    const { data: byName } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('entity_id', entityId)
      .ilike('account_name', resolver.replace(/_/g, ' '))
      .single();

    return byName?.id || null;
  }

  async getVatCategory(entityId: string, accountId: string): Promise<VatCategory> {
    const { data } = await supabase
      .from('chart_of_accounts')
      .select('vat_category')
      .eq('id', accountId)
      .single();

    return (data?.vat_category as VatCategory) || 'non_vatable';
  }

  async getCurrentPeriod(entityId: string): Promise<string | null> {
    const { data } = await supabase
      .from('financial_periods')
      .select('id')
      .eq('entity_id', entityId)
      .eq('period_type', 'financial')
      .eq('status', 'open')
      .order('start_date')
      .limit(1)
      .single();

    return data?.id || null;
  }

  async getPeriodById(periodId: string): Promise<{ id: string; period_name: string } | null> {
    const { data } = await supabase
      .from('financial_periods')
      .select('id, period_name')
      .eq('id', periodId)
      .single();

    return data || null;
  }

  calculateVat(amount: number, vatTreatment: VatCategory): { vatAmount: number; vatRate: number } {
    if (vatTreatment === 'standard') {
      const vatRate = 15;
      return { vatAmount: Math.round(amount * (vatRate / 100) * 100) / 100, vatRate };
    }
    return { vatAmount: 0, vatRate: 0 };
  }

  buildFormulaContext(event: FinancialEvent, vatAmount: number, vatRate: number): Record<string, number> {
    return {
      amount: event.amount,
      vat: vatAmount,
      vat_rate: vatRate,
      monthly_rental: event.metadata?.monthly_rental || 0,
      deposit: event.metadata?.deposit || 0,
      recoveries: event.metadata?.recoveries || 0,
      interest: event.metadata?.interest || 0,
      commission: event.metadata?.commission || 0,
      budget: event.metadata?.budget || 0,
    };
  }
}

export const financialRulesEngine = new FinancialRulesEngine();
