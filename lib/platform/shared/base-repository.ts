// lib/platform/shared/base-repository.ts
// Platform Rule 001 — Every domain module follows this pattern
// Repository → Service → UI

import { supabase } from '@/lib/supabase';

export class BaseRepository {
  constructor(private table: string) {}

  async findAll(orderBy = 'created_at', ascending = false) {
    const { data } = await supabase.from(this.table).select('*').order(orderBy, { ascending });
    return data || [];
  }

  async findById(id: string) {
    const { data } = await supabase.from(this.table).select('*').eq('id', id).single();
    return data;
  }

  async create(data: Record<string, any>) {
    const { data: record, error } = await supabase.from(this.table).insert(data).select('*').single();
    if (error) throw error;
    return record;
  }

  async update(id: string, data: Record<string, any>) {
    const { error } = await supabase.from(this.table).update({ ...data, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  }

  async archive(id: string, archiveField = 'is_archived', statusField = 'is_active') {
    await supabase.from(this.table).update({ [archiveField]: true, [statusField]: false, updated_at: new Date().toISOString() }).eq('id', id);
  }

  async countRelated(relatedTable: string, foreignKey: string, id: string, filters?: Record<string, any>) {
    let query = supabase.from(relatedTable).select('id', { count: 'exact', head: true }).eq(foreignKey, id);
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        query = query.eq(key, value);
      }
    }
    const { count } = await query;
    return count || 0;
  }
}
