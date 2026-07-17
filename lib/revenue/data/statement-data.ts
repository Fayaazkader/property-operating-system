// lib/revenue/data/statement-data.ts
// Data access only. No business logic.

import { supabase } from '@/lib/supabase';

export const statementData = {
  async getInvoiceConfig(entityId: string) {
    const { data } = await supabase.from('invoice_configs').select('*').eq('entity_id', entityId).single();
    return data;
  },

  async getStatementConfig(entityId: string) {
    const { data } = await supabase.from('statement_configs').select('*').eq('entity_id', entityId).single();
    return data;
  },

  async getTenantOverrides(entityId: string, tenantId: string) {
    const { data } = await supabase.from('statement_overrides').select('*').eq('entity_id', entityId).eq('tenant_id', tenantId);
    return data || [];
  },

  async getTenantLedger(entityId: string, tenantId: string) {
    const { data } = await supabase
      .from('sub_ledger_entries')
      .select('*')
      .eq('entity_id', entityId)
      .eq('tenant_id', tenantId)
      .eq('ledger_type', 'tenant')
      .order('posted_at', { ascending: true });
    return data || [];
  },

  async getTenantInfo(tenantId: string) {
    const { data } = await supabase.from('tenants').select('id, tenant_name').eq('id', tenantId).single();
    return data;
  },

  async getActiveLease(tenantId: string) {
    const { data } = await supabase.from('leases').select('id, property_id, lease_ref').eq('tenant_id', tenantId).eq('lease_status', 'Active').single();
    return data;
  },

  async getProperty(propertyId: string) {
    const { data } = await supabase.from('properties').select('property_name').eq('id', propertyId).single();
    return data;
  },

  async getDepositHeld(tenantId: string) {
    const { data } = await supabase.from('deposit_register').select('current_balance').eq('tenant_id', tenantId).eq('status', 'held').single();
    return data?.current_balance || 0;
  },

  async saveStatement(params: {
    entityId: string; tenantId: string; data: any; version: number;
    status: string; generatedBy?: string; reason?: string; supersedesVersion?: number;
  }) {
    const { data } = await supabase.from('statements_generated').insert({
      entity_id: params.entityId,
      tenant_id: params.tenantId,
      statement_data: params.data,
      version: params.version,
      status: params.status,
      generated_by: params.generatedBy,
      change_reason: params.reason,
      supersedes_version: params.supersedesVersion,
    }).select('*').single();
    return data;
  },

  async getLatestVersion(entityId: string, tenantId: string) {
    const { count } = await supabase
      .from('statements_generated')
      .select('*', { count: 'exact', head: true })
      .eq('entity_id', entityId)
      .eq('tenant_id', tenantId);
    return (count || 0) + 1;
  },

  async getStatementHistory(entityId: string, tenantId: string) {
    const { data } = await supabase
      .from('statements_generated')
      .select('id, version, status, generated_at, change_reason, generated_by')
      .eq('entity_id', entityId)
      .eq('tenant_id', tenantId)
      .order('version', { ascending: false });
    return data || [];
  }
};
