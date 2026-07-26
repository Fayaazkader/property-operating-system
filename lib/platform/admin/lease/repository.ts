import { BaseRepository } from '../../shared/base-repository';
import { supabase } from '@/lib/supabase';
import type { Lease, LeaseStatus } from './types';

const base = new BaseRepository<Lease>('leases');

export const leaseRepository = {
  findAll: base.findAll.bind(base),
  findById: base.findById.bind(base),
  create: base.create.bind(base),
  update: base.update.bind(base),
  countRelated: base.countRelated.bind(base),

  async findByLeaseCode(leaseId: string): Promise<Lease | null> {
    const { data } = await supabase.from('leases').select('*').eq('lease_id', leaseId).single();
    return data as Lease | null;
  },

  async findByTenant(tenantId: string): Promise<Lease[]> {
    const { data } = await supabase.from('leases').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    return (data || []) as Lease[];
  },

  async findByProperty(propertyId: string): Promise<Lease[]> {
    const { data } = await supabase.from('leases').select('*').eq('property_id', propertyId).order('created_at', { ascending: false });
    return (data || []) as Lease[];
  },

  async findByEntity(entityId: string): Promise<Lease[]> {
    const { data } = await supabase.from('leases').select('*').or(`owner_entity_id.eq.${entityId},managing_entity_id.eq.${entityId}`).order('created_at', { ascending: false });
    return (data || []) as Lease[];
  },

  async findByStatus(status: LeaseStatus): Promise<Lease[]> {
    const { data } = await supabase.from('leases').select('*').eq('lease_status', status).order('created_at', { ascending: false });
    return (data || []) as Lease[];
  },

  async existsActiveOnUnit(unitId: string): Promise<boolean> {
    const { data } = await supabase.from('leases').select('id').eq('unit_id', unitId).eq('lease_status', 'Active').single();
    return !!data;
  },

  async findExpiring(days: number = 90): Promise<Lease[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    const { data } = await supabase.from('leases').select('*').eq('lease_status', 'Active').lte('lease_end_date', cutoff.toISOString().split('T')[0]).order('lease_end_date');
    return (data || []) as Lease[];
  },

  async findExpiringBetween(startDays: number, endDays: number): Promise<Lease[]> {
    const now = new Date();
    const start = new Date(now); start.setDate(start.getDate() + startDays);
    const end = new Date(now); end.setDate(end.getDate() + endDays);
    const { data } = await supabase.from('leases').select('*').eq('lease_status', 'Active').gte('lease_end_date', start.toISOString().split('T')[0]).lte('lease_end_date', end.toISOString().split('T')[0]).order('lease_end_date');
    return (data || []) as Lease[];
  },

  async addTimelineEvent(leaseId: string, eventType: string, description: string) {
    await supabase.from('lease_timeline').insert({
      lease_id: leaseId,
      event_type: eventType,
      description,
      created_at: new Date().toISOString(),
    });
  },

  async archive(id: string) {
    await base.update(id, { lease_status: 'Archived' } as any);
  }
};
