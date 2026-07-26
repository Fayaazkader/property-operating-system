import { BaseRepository } from '../../shared/base-repository';
import { supabase } from '@/lib/supabase';
import type { Tenant } from './types';

const base = new BaseRepository<Tenant>('tenants');

export const tenantRepository = {
  findAll: base.findAll.bind(base),
  findById: base.findById.bind(base),
  create: base.create.bind(base),
  update: base.update.bind(base),
  countRelated: base.countRelated.bind(base),

  async findByEntity(entityId: string): Promise<Tenant[]> {
    const { data } = await supabase
      .from('tenants')
      .select('*')
      .eq('entity_id', entityId)
      .order('tenant_name');
    return (data || []) as Tenant[];
  },

  async getActiveLeaseCount(tenantId: string): Promise<number> {
    return base.countRelated('leases', 'tenant_id', tenantId, { lease_status: 'Active' });
  },

  async getOutstandingInvoices(tenantId: string): Promise<number> {
    return base.countRelated('invoices', 'tenant_id', tenantId, { status: 'unpaid' });
  },

  async archive(id: string) {
    await base.update(id, { status: 'Archived', is_archived: true } as any);
  }
};
