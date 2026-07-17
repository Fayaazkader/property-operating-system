// lib/revenue/services/config-service.ts
// Single configuration owner for Revenue module.

import { supabase } from '@/lib/supabase';

export interface InvoiceConfig {
  id?: string;
  entity_id: string;
  show_balance_brought_forward: boolean;
  show_deposit_guarantee: boolean;
  header_message: string;
  footer_message: string;
}

export interface StatementConfig {
  id?: string;
  entity_id: string;
  show_next_period_charges: boolean;
  header_message: string;
  footer_message: string;
}

export interface InvoiceBranding {
  logo_url?: string;
  company_name?: string;
  company_address?: string;
  company_contact?: string;
  company_vat_number?: string;
  company_reg_number?: string;
}

export const configService = {
  async getInvoiceConfig(entityId: string): Promise<InvoiceConfig & InvoiceBranding> {
    const { data } = await supabase.from('invoice_configs').select('*').eq('entity_id', entityId).single();
    return data || { entity_id: entityId, show_balance_brought_forward: true, show_deposit_guarantee: true, header_message: '', footer_message: 'Payment due within 7 days.' };
  },

  async getStatementConfig(entityId: string): Promise<StatementConfig & InvoiceBranding> {
    const { data } = await supabase.from('statement_configs').select('*').eq('entity_id', entityId).single();
    return data || { entity_id: entityId, show_next_period_charges: true, header_message: '', footer_message: 'This is a statement of account.' };
  },

  async getTenantOverride(entityId: string, tenantId: string, key: string): Promise<string | null> {
    const { data } = await supabase.from('statement_overrides').select('setting_value').eq('entity_id', entityId).eq('tenant_id', tenantId).eq('setting_key', key).single();
    return data?.setting_value || null;
  },

  async getTenantOverrides(entityId: string, tenantId: string): Promise<Array<{ setting_key: string; setting_value: string }>> {
    const { data } = await supabase.from('statement_overrides').select('setting_key, setting_value').eq('entity_id', entityId).eq('tenant_id', tenantId);
    return data || [];
  },

  async saveInvoiceConfig(config: InvoiceConfig): Promise<void> {
    await supabase.from('invoice_configs').upsert(config, { onConflict: 'entity_id' });
  },

  async saveStatementConfig(config: StatementConfig): Promise<void> {
    await supabase.from('statement_configs').upsert(config, { onConflict: 'entity_id' });
  },

  async setTenantOverride(entityId: string, tenantId: string, key: string, value: string): Promise<void> {
    await supabase.from('statement_overrides').upsert({ entity_id: entityId, tenant_id: tenantId, setting_key: key, setting_value: value }, { onConflict: 'entity_id,tenant_id,setting_key' });
  }
};
