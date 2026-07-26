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

export interface ArchiveIssue {
  code: string;
  count: number;
  label: string;
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
    const [properties, tenants, leases, users] = await Promise.all([
      entityRepository.countRelated('properties', 'entity_id', entityId),
      entityRepository.countRelated('tenants', 'entity_id', entityId),
      entityRepository.countRelated('leases', 'entity_id', entityId),
      entityRepository.countRelated('user_entity_access', 'entity_id', entityId),
    ]);
    return { properties, tenants, leases, users };
  },

  async canArchive(entityId: string): Promise<{ canArchive: boolean; issues: ArchiveIssue[] }> {
    const issues: ArchiveIssue[] = [];

    const activeLeases = await entityRepository.countRelated('leases', 'entity_id', entityId, { lease_status: 'Active' });
    if (activeLeases > 0) issues.push({ code: 'ACTIVE_LEASES', count: activeLeases, label: 'Active Leases' });

    const openPeriods = await entityRepository.countRelated('financial_periods', 'entity_id', entityId, { status: 'open' });
    if (openPeriods > 0) issues.push({ code: 'OPEN_FINANCIAL_PERIODS', count: openPeriods, label: 'Open Financial Periods' });

    const unreconciled = await entityRepository.countRelated('bank_transactions', 'entity_id', entityId, { is_reconciled: false });
    if (unreconciled > 0) issues.push({ code: 'UNRECONCILED_TRANSACTIONS', count: unreconciled, label: 'Unreconciled Bank Transactions' });

    const openInvoices = await entityRepository.countRelated('supplier_invoices', 'entity_id', entityId, { status: 'pending' });
    if (openInvoices > 0) issues.push({ code: 'OPEN_SUPPLIER_INVOICES', count: openInvoices, label: 'Open Supplier Invoices' });

    const activeRules = await entityRepository.countRelated('billing_rules', 'entity_id', entityId, { status: 'active' });
    if (activeRules > 0) issues.push({ code: 'ACTIVE_BILLING_RULES', count: activeRules, label: 'Active Billing Rules' });

    return { canArchive: issues.length === 0, issues };
  },

  async archive(entityId: string) {
    const { canArchive, issues } = await this.canArchive(entityId);
    if (!canArchive) throw new Error(issues.map(i => i.label).join(', '));
    await entityRepository.archive(entityId);
  }
};
