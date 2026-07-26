// lib/platform/admin/entity-service.ts
// Entity business logic — reusable across UI, API, onboarding

import { entityRepository } from './entity-repository';

export interface EntityData {
  name: string;
  trading_name?: string;
  entity_code?: string;
  registration_number?: string;
  vat_number?: string;
  physical_address?: string;
  postal_address?: string;
  telephone?: string;
  email?: string;
  website?: string;
  country?: string;
  financial_year_start?: number;
  accounting_mode?: string;
  base_currency?: string;
  is_active?: boolean;
}

export interface EntityStats {
  properties: number;
  tenants: number;
  leases: number;
  users: number;
}

export const entityService = {
  async list() {
    return entityRepository.findAll();
  },

  async create(data: EntityData) {
    return entityRepository.create({
      ...data,
      name: data.name,
      entity_name: data.name,
      entity_code: data.entity_code || 'ENT-' + Date.now().toString(36).toUpperCase(),
      updated_at: new Date().toISOString(),
    });
  },

  async update(id: string, data: EntityData) {
    await entityRepository.update(id, { ...data, updated_at: new Date().toISOString() });
  },

  async getStats(entityId: string): Promise<EntityStats> {
    const [props, tenants, leases, users] = await Promise.all([
      supabase.from('properties').select('id', { count: 'exact', head: true }).eq('entity_id', entityId),
      supabase.from('tenants').select('id', { count: 'exact', head: true }).eq('entity_id', entityId),
      supabase.from('leases').select('id', { count: 'exact', head: true }).or(`owner_entity_id.eq.${entityId},managing_entity_id.eq.${entityId}`),
      supabase.from('user_entity_access').select('id', { count: 'exact', head: true }).eq('entity_id', entityId),
    ]);
    return {
      properties: props.count || 0,
      tenants: tenants.count || 0,
      leases: leases.count || 0,
      users: users.count || 0,
    };
  },

  async canArchive(entityId: string): Promise<{ canArchive: boolean; issues: Array<{ code: string; count: number; label: string }> }> {
    const issues: Array<{ code: string; count: number; label: string }> = [];

    const { count: activeLeases } = await supabase.from('leases').select('id', { count: 'exact', head: true }).or(`owner_entity_id.eq.${entityId},managing_entity_id.eq.${entityId}`).eq('lease_status', 'Active');
    if (activeLeases && activeLeases > 0) issues.push({ code: 'ACTIVE_LEASES', count: activeLeases, label: 'Active Leases' });

    const { count: openPeriods } = await supabase.from('financial_periods').select('id', { count: 'exact', head: true }).eq('entity_id', entityId).eq('status', 'open');
    if (openPeriods && openPeriods > 0) issues.push({ code: 'OPEN_FINANCIAL_PERIODS', count: openPeriods, label: 'Open Financial Periods' });

    const { count: unreconciled } = await supabase.from('bank_transactions').select('id', { count: 'exact', head: true }).eq('entity_id', entityId).eq('is_reconciled', false);
    if (unreconciled && unreconciled > 0) issues.push({ code: 'UNRECONCILED_TRANSACTIONS', count: unreconciled, label: 'Unreconciled Bank Transactions' });

    const { count: openInvoices } = await supabase.from('supplier_invoices').select('id', { count: 'exact', head: true }).eq('entity_id', entityId).eq('status', 'pending');
    if (openInvoices && openInvoices > 0) issues.push({ code: 'OPEN_SUPPLIER_INVOICES', count: openInvoices, label: 'Open Supplier Invoices' });

    const { count: activeRules } = await supabase.from('billing_rules').select('id', { count: 'exact', head: true }).eq('status', 'active');
    if (activeRules && activeRules > 0) issues.push({ code: 'ACTIVE_BILLING_RULES', count: activeRules, label: 'Active Billing Rules' });

    return { canArchive: issues.length === 0, issues };
  },

  async archive(entityId: string) {
    const { canArchive, issues } = await this.canArchive(entityId);
    if (!canArchive) throw new Error(issues.join(', '));
    await entityRepository.archive(entityId);
  }
};
