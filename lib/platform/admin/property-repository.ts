import { supabase } from '@/lib/supabase';

export const propertyRepository = {
  async findAll(entityId?: string) {
    let query = supabase.from('properties').select('*').order('property_name');
    if (entityId) query = query.eq('entity_id', entityId);
    const { data } = await query;
    return data || [];
  },

  async findById(id: string) {
    const { data } = await supabase.from('properties').select('*').eq('id', id).single();
    return data;
  },

  async create(data: Record<string, any>) {
    const { data: property, error } = await supabase.from('properties').insert(data).select('*').single();
    if (error) throw error;
    return property;
  },

  async update(id: string, data: Record<string, any>) {
    const { error } = await supabase.from('properties').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },

  async archive(id: string) {
    await supabase.from('properties').update({ property_status: 'Archived', updated_at: new Date().toISOString() }).eq('id', id);
  },

  async countRelated(table: string, foreignKey: string, id: string, filters?: Record<string, any>) {
    let query = supabase.from(table).select('id', { count: 'exact', head: true }).eq(foreignKey, id);
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        query = query.eq(key, value);
      }
    }
    const { count } = await query;
    return count || 0;
  }
};
