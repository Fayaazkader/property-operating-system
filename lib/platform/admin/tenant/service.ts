import { tenantRepository } from './repository';
import { codeGenerator } from '../../shared/code-generator';
import { tenantValidators } from './validators';
import type { TenantData, ArchiveIssue } from './types';

export const tenantService = {
  async list(entityId?: string) {
    if (entityId) return tenantRepository.findByEntity(entityId);
    return tenantRepository.findAll();
  },

  async get(id: string) {
    return tenantRepository.findById(id);
  },

  async create(data: TenantData) {
    const errors = tenantValidators.validateRequired(data);
    if (errors.length > 0) throw new Error(errors.join('; '));

    return tenantRepository.create({
      ...data,
      code: await codeGenerator.generate('TNT', 'tenants'),
      tenant_type: data.tenant_type || 'Company',
      payment_terms: data.payment_terms || 'Net 30',
      kyc_status: data.kyc_status || 'Pending',
      risk_rating: data.risk_rating || 'Low',
      status: 'Active',
      is_archived: false,
      whatsapp_enabled: true,
      email_enabled: true,
      sms_enabled: false,
      created_at: new Date().toISOString(),
    });
  },

  async update(id: string, data: Partial<TenantData>) {
    await tenantRepository.update(id, data);
  },

  async archive(id: string) {
    const { canArchive, issues } = await this.canArchive(id);
    if (!canArchive) throw new Error(issues.map(i => i.label).join('; '));
    await tenantRepository.update(id, { status: 'Archived', is_archived: true } as any);
  },

  async canArchive(id: string): Promise<{ canArchive: boolean; issues: ArchiveIssue[] }> {
    const issues: ArchiveIssue[] = [];

    const activeLeases = await tenantRepository.getActiveLeaseCount(id);
    if (activeLeases > 0) issues.push({ code: 'ACTIVE_LEASES', count: activeLeases, label: 'Active lease(s) exist' });

    const outstandingInvoices = await tenantRepository.getOutstandingInvoices(id);
    if (outstandingInvoices > 0) issues.push({ code: 'OUTSTANDING_INVOICES', count: outstandingInvoices, label: 'Outstanding invoices — override available for absconded' });

    const unallocatedReceipts = await tenantRepository.countRelated('bank_transactions', 'tenant_id', id, { is_reconciled: false });
    if (unallocatedReceipts > 0) issues.push({ code: 'UNALLOCATED_RECEIPTS', count: unallocatedReceipts, label: 'Unallocated receipts exist' });

    return { canArchive: issues.length === 0, issues };
  },

  async blacklist(id: string) {
    await tenantRepository.update(id, { status: 'Blacklisted' } as any);
  },

  async markAbsconded(id: string) {
    await tenantRepository.update(id, { status: 'Absconded' } as any);
  },

  isBlacklisted(tenant: { status: string }): boolean {
    return tenant.status === 'Blacklisted';
  }
};
