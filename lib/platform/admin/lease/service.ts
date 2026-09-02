import { leaseRepository } from './repository';
import { archiveService } from '../../shared/archive-service';
import { publish } from '@/lib/platform/events/event-bus';
import { leaseActivationService } from '@/lib/workflow/services/lease-activation-service';

export const leaseService = {
  // Queries
  async list() { return leaseRepository.findAll(); },
  async get(id: string) { return leaseRepository.findById(id); },
  async getByCode(leaseId: string) { return leaseRepository.findByLeaseCode(leaseId); },
  async getByTenant(tenantId: string) { return leaseRepository.findByTenant(tenantId); },
  async getByProperty(propertyId: string) { return leaseRepository.findByProperty(propertyId); },
  async getExpiring(days: number = 90) { return leaseRepository.findExpiring(days); },

 
  async update(id: string, data: Record<string, any>) {
    await leaseRepository.update(id, data);
  },

  async archive(id: string) {
    const result = await archiveService.execute(
      async () => {
        const lease = await leaseRepository.findById(id);
        const issues: Array<{ code: string; count: number; label: string }> = [];
        if (lease?.lease_status === 'Active') issues.push({ code: 'ACTIVE_LEASE', count: 1, label: 'Lease is still active — terminate first' });
        const outstanding = await leaseRepository.countRelated('invoices', 'lease_id', id, { status: 'unpaid' });
        if (outstanding > 0) issues.push({ code: 'OUTSTANDING_INVOICES', count: outstanding, label: 'Outstanding invoices exist' });
        return { canArchive: issues.length === 0, issues };
      },
      async () => {
        await leaseRepository.archive(id);
        await leaseRepository.addTimelineEvent(id, 'lease_archived', 'Lease archived');
      }
    );

    if (!result.success) throw new Error(result.issues.map(i => i.label).join('; '));

    await publish('lease.archived', {
      correlationId: crypto.randomUUID(),
      source: 'lease-service',
      version: '1.0',
      payload: { leaseId: id },
    });
  }
};
