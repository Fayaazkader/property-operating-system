// lib/portfolio/read-model-store.ts
// Read Model Store — Cached pre-aggregated data for fast reads

import { supabase } from '@/lib/supabase';
import type { ReadModel, ReadModelType } from './types';

export class ReadModelStore {
  private readonly DEFAULT_TTL_MINUTES = 15;

  async get(entityId: string, modelType: ReadModelType): Promise<ReadModel | null> {
    const { data } = await supabase
      .from('portfolio_read_model')
      .select('*')
      .eq('entity_id', entityId)
      .eq('model_type', modelType)
      .gt('expires_at', new Date().toISOString())
      .single();

    return data as ReadModel || null;
  }

  async set(entityId: string, modelType: ReadModelType, modelData: Record<string, any>, ttlMinutes?: number): Promise<void> {
    const expiresAt = new Date(Date.now() + (ttlMinutes || this.DEFAULT_TTL_MINUTES) * 60 * 1000).toISOString();

    await supabase
      .from('portfolio_read_model')
      .upsert({
        entity_id: entityId,
        model_type: modelType,
        model_data: modelData,
        calculated_at: new Date().toISOString(),
        expires_at: expiresAt,
      }, { onConflict: 'entity_id,model_type' });
  }

  async invalidate(entityId: string, modelType?: ReadModelType): Promise<void> {
    let query = supabase.from('portfolio_read_model').delete().eq('entity_id', entityId);
    if (modelType) query = query.eq('model_type', modelType);
    await query;
  }

  async isStale(entityId: string, modelType: ReadModelType): Promise<boolean> {
    const model = await this.get(entityId, modelType);
    return !model;
  }
}

export const readModelStore = new ReadModelStore();
