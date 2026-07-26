// lib/platform/admin/entity-repository.ts
// Entity data access — single source for all entity database operations

import { supabase } from '@/lib/supabase';

export const entityRepository = {
  async findAll() {
    const { data } = await supabase.from('entities').select('*').order('created_at', { ascending: false });
    return data || [];
  },

  async findById(id: string) {
    const { data } = await supabase.from('entities').select('*').eq('id', id).single();
    return data;
  },

  async create(data: Record<string, any>) {
    const { data: entity, error } = await supabase.from('entities').insert(data).select('*').single();
    if (error) throw error;
    return entity;
  },

  async update(id: string, data: Record<string, any>) {
    const { error } = await supabase.from('entities').update(data).eq('id', id);
    if (error) throw error;
  },

  async archive(id: string) {
    await supabase.from('entities').update({ is_archived: true, is_active: false, updated_at: new Date().toISOString() }).eq('id', id);
  },

  async countRelated(entityId: string, table: string, filter?: Record<string, any>) {
    let query = supabase.from(table).select('id', { count: 'exact', head: true });
    if (filter) {
      for (const [key, value] of Object.entries(filter)) {
        query = query.eq(key, value);
      }
    }
    const { count } = await query;
    return count || 0;
  }
};
