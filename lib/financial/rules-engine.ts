// lib/financial/rules-engine.ts
// Financial Rules Engine — Central financial decision engine

import { supabase } from '@/lib/supabase';
import { formulaEngine } from './formula-engine';
import { requireTransactionDate } from './transaction-date';
import { selectFinancialPeriod } from './period-selection';
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
    const {data:config,error:configError}=await supabase.from('accounting_config')
      .select('account_id').eq('entity_id',entityId).eq('business_role',resolver).eq('is_active',true).maybeSingle();
    if(configError)throw new Error('Account role configuration is ambiguous or unavailable');
    if(config){const {data:account,error}=await supabase.from('chart_of_accounts').select('id').eq('id',config.account_id).eq('entity_id',entityId).eq('is_active',true).single();if(error||!account)throw new Error('Configured account is unavailable in this entity');return account.id;}
    const { data: byGlCode } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('entity_id', entityId)
      .eq('gl_code', resolver)
      .eq('is_active', true)
      .single();

    if (byGlCode) return byGlCode.id;

    const { data: byName } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('entity_id', entityId)
      .eq('is_active',true)
      .ilike('account_name', resolver.replace(/_/g, ' '))
      .single();

    return byName?.id || null;
  }

  async getVatCategory(entityId: string, accountId: string): Promise<VatCategory> {
    const { data } = await supabase
      .from('chart_of_accounts')
      .select('vat_category')
      .eq('id', accountId)
      .eq('entity_id',entityId)
      .single();

    return (data?.vat_category as VatCategory) || 'non_vatable';
  }

  /**
   * Resolve the entity's current financial period.
   * The immediately following calendar month is advance-postable,
   * but is never considered the current/open period.
   */
  private async assertPostingPeriod(
    entityId: string,
    period: {
      id: string;
      status: string;
      period_start: string;
      period_end: string;
    },
  ): Promise<string> {
    const { data: current, error } = await supabase
      .from('financial_periods')
      .select('id, period_start, period_end')
      .eq('entity_id', entityId)
      .eq('period_type', 'financial')
      .eq('status', 'open')
      .limit(2);

    if (error || !current || current.length !== 1) {
      throw new Error('Exactly one current financial period is required');
    }

    if (period.id === current[0].id && period.status === 'open') {
      return period.id;
    }

    const currentStart = current[0].period_start;
    const [year, month] = currentStart.split('-').map(Number);

    const nextStart = new Date(Date.UTC(year, month, 1))
      .toISOString()
      .slice(0, 10);

    const nextEnd = new Date(Date.UTC(year, month + 1, 0))
      .toISOString()
      .slice(0, 10);

    if (
      period.status === 'advance' &&
      period.period_start === nextStart &&
      period.period_end === nextEnd
    ) {
      return period.id;
    }

    throw new Error(
      'Posting is permitted only in the current or immediately next financial period',
    );
  }

  async getPeriodForDate(
    entityId: string,
    effectiveDate: string,
  ): Promise<string> {
    const date = requireTransactionDate(effectiveDate);

    const { data, error } = await supabase
      .from('financial_periods')
      .select('id, status, period_start, period_end')
      .eq('entity_id', entityId)
      .eq('period_type', 'financial')
      .in('status', ['open', 'advance'])
      .lte('period_start', date)
      .gte('period_end', date)
      .limit(2);

    if (error) {
      throw new Error(`Financial period lookup failed: ${error.message}`);
    }

    if (!data || data.length !== 1) {
      throw new Error('Exactly one eligible financial period is required for transaction date');
    }

    return this.assertPostingPeriod(entityId, data[0]);
  }

  async getExplicitPostingPeriod(
    entityId: string,
    periodId: string,
  ): Promise<string> {
    const { data, error } = await supabase
      .from('financial_periods')
      .select('id, status, period_start, period_end')
      .eq('id', periodId)
      .eq('entity_id', entityId)
      .eq('period_type', 'financial')
      .maybeSingle();

    if (error || !data) {
      throw new Error(
        'Selected financial period is unavailable or belongs to another entity',
      );
    }

    return this.assertPostingPeriod(entityId, data);
  }

  async getCurrentPeriod(entityId: string): Promise<string | null> {
    const { data } = await supabase
      .from('financial_periods')
      .select('id')
      .eq('entity_id', entityId)
      .eq('period_type', 'financial')
      .eq('status', 'open')
      .order('period_start')
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

  async calculateVat(entityId:string,amount: number, vatTreatment: VatCategory): Promise<{ vatAmount: number; vatRate: number }> {
    if (vatTreatment === 'standard') {
      const {data,error}=await supabase.from('tax_config').select('tax_rate').eq('entity_id',entityId).eq('tax_code','VAT_STANDARD').eq('is_active',true).single();
      const vatRate=Number(data?.tax_rate);if(error||!data||!Number.isFinite(vatRate)||vatRate<0||vatRate>100)throw new Error('Explicit entity VAT configuration required');
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
