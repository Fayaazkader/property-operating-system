import { BaseRepository } from '../../shared/base-repository';
import { supabase } from '@/lib/supabase';
import type { Unit } from './types';

const base = new BaseRepository<Unit>('units');

export const premisesRepository = {
  findAll: base.findAll.bind(base),
  findById: base.findById.bind(base),
  create: base.create.bind(base),
  update: base.update.bind(base),
  countRelated: base.countRelated.bind(base),
  
  async findByProperty(propertyId: string): Promise<Unit[]> {
    const { data } = await supabase
      .from('units')
      .select('*')
      .eq('property_id', propertyId)
      .order('unit_number');
    return (data || []) as Unit[];
  },

  async getTotalGLA(units?: Unit[]): Promise<number> {
    return (units || []).reduce((sum, u) => sum + (u.gla_sqm || 0), 0);
  },

  async getPropertyGLA(propertyId: string): Promise<number> {
    const { data } = await supabase
      .from('properties')
      .select('total_gla_sqm')
      .eq('id', propertyId)
      .single();
    return data?.total_gla_sqm || 0;
  },

  async archive(id: string) {
    await base.update(id, { operational_status: 'Decommissioned', occupancy_status: 'Vacant' } as any);
  }
};
