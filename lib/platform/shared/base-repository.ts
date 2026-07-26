import { supabase } from '@/lib/supabase';

export class BaseRepository<T = Record<string, any>> {
  constructor(private table: string) {}

  async findAll(orderBy = 'created_at', ascending = false): Promise<T[]> {
    const { data } = await supabase.from(this.table).select('*').order(orderBy, { ascending });
    return (data || []) as T[];
  }

  async findById(id: string): Promise<T | null> {
    const { data } = await supabase.from(this.table).select('*').eq('id', id).single();
    return data as T | null;
  }

  async create(data: Partial<T>): Promise<T> {
    const { data: record, error } = await supabase.from(this.table).insert(data as any).select('*').single();
    if (error) throw error;
    return record as T;
  }

  async update(id: string, data: Partial<T>): Promise<void> {
    const { error } = await supabase.from(this.table).update({ ...data, updated_at: new Date().toISOString() } as any).eq('id', id);
    if (error) throw error;
  }

  async countRelated(relatedTable: string, foreignKey: string, id: string, filters?: Record<string, any>): Promise<number> {
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
