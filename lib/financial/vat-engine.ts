// lib/financial/vat-engine.ts
// VAT Engine — Uses account VAT metadata, not GL codes

import { supabase } from '@/lib/supabase';
import { publish } from '../platform/events/event-bus';
import type { VatReturn } from './types';

export class VatEngine {
  async calculateVat(entityId: string, periodId: string): Promise<VatReturn> {
    // Get VAT-relevant accounts by metadata, not GL code
    const { data: vatOutputAccounts } = await supabase.from('chart_of_accounts').select('id').eq('entity_id', entityId).eq('vat_category', 'standard').eq('account_type', 'income');
    const { data: vatInputAccounts } = await supabase.from('chart_of_accounts').select('id').eq('entity_id', entityId).eq('vat_category', 'standard').eq('account_type', 'expense');

    let outputVat = 0, inputVat = 0;

    if (vatOutputAccounts?.length) {
      const outputIds = vatOutputAccounts.map(a => a.id);
      const { data: outputLines } = await supabase.from('journal_lines').select('vat_amount').in('account_id', outputIds).eq('journals.period_id', periodId).gt('vat_amount', 0);
      outputVat = (outputLines || []).reduce((s, l) => s + (l.vat_amount || 0), 0);
    }

    if (vatInputAccounts?.length) {
      const inputIds = vatInputAccounts.map(a => a.id);
      const { data: inputLines } = await supabase.from('journal_lines').select('vat_amount').in('account_id', inputIds).eq('journals.period_id', periodId).gt('vat_amount', 0);
      inputVat = (inputLines || []).reduce((s, l) => s + (l.vat_amount || 0), 0);
    }

    const netVat = outputVat - inputVat;

    const { data, error } = await supabase.from('vat_returns').upsert({
      entity_id: entityId, period_id: periodId,
      output_vat: Math.round(outputVat * 100) / 100,
      input_vat: Math.round(inputVat * 100) / 100,
      net_vat: Math.round(netVat * 100) / 100,
      status: 'draft',
    }, { onConflict: 'entity_id,period_id' }).select('*').single();

    if (error) throw error;

    await publish('vat.calculated', {
      correlationId: crypto.randomUUID(), source: 'vat-engine', version: '1.0',
      payload: { entityId, periodId, outputVat, inputVat, netVat },
    });

    return data as VatReturn;
  }

  async getVatReturn(entityId: string, periodId: string): Promise<VatReturn | null> {
    const { data } = await supabase.from('vat_returns').select('*').eq('entity_id', entityId).eq('period_id', periodId).single();
    return data as VatReturn || null;
  }

  async fileReturn(returnId: string): Promise<void> {
    await supabase.from('vat_returns').update({ status: 'filed', filed_at: new Date().toISOString() }).eq('id', returnId);

    await publish('vat.filed', {
      correlationId: crypto.randomUUID(), source: 'vat-engine', version: '1.0',
      payload: { returnId },
    });
  }
}

export const vatEngine = new VatEngine();
