// lib/property-operations/repositories/asset.repository.ts
// Asset Repository — Persistence Abstraction

import { supabase } from "@/lib/supabase";
import { ServiceResult } from "@/lib/platform/types";
import { Asset, CreateAssetParams, UpdateAssetParams } from '../types';

export class AssetRepository {
  private supabase = supabase;

  async create(data: any): Promise<ServiceResult<Asset>> {
    try {
      const { data: result, error } = await this.supabase
        .from('assets')
        .insert(data)
        .select()
        .single();

      if (error || !result) {
        return {
          error: { code: 'ASSET_CREATE_FAILED', message: error?.message || 'Failed to create asset' },
        };
      }

      return { data: result as Asset };
    } catch (error) {
      return {
        error: {
          code: 'ASSET_CREATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async findById(id: string): Promise<ServiceResult<Asset>> {
    try {
      const { data, error } = await this.supabase
        .from('assets')
        .select('*, property:properties(property_name), supplier:suppliers(name)')
        .eq('id', id)
        .single();

      if (error || !data) {
        return {
          error: { code: 'ASSET_NOT_FOUND', message: error?.message || 'Asset not found' },
        };
      }

      return { data: data as Asset };
    } catch (error) {
      return {
        error: {
          code: 'ASSET_GET_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async findByProperty(propertyId: string): Promise<ServiceResult<Asset[]>> {
    try {
      const { data, error } = await this.supabase
        .from('assets')
        .select('*')
        .eq('property_id', propertyId)
        .order('name', { ascending: true });

      if (error) {
        return {
          error: { code: 'ASSET_LIST_FAILED', message: error.message },
        };
      }

      return { data: data as Asset[] };
    } catch (error) {
      return {
        error: {
          code: 'ASSET_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async findByEntity(entityId: string): Promise<ServiceResult<Asset[]>> {
    try {
      const { data, error } = await this.supabase
        .from('assets')
        .select('*, property:properties(property_name)')
        .eq('entity_id', entityId)
        .order('name', { ascending: true });

      if (error) {
        return {
          error: { code: 'ASSET_LIST_FAILED', message: error.message },
        };
      }

      return { data: data as Asset[] };
    } catch (error) {
      return {
        error: {
          code: 'ASSET_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async update(id: string, data: Partial<Asset>): Promise<ServiceResult<Asset>> {
    try {
      const { data: result, error } = await this.supabase
        .from('assets')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error || !result) {
        return {
          error: { code: 'ASSET_UPDATE_FAILED', message: error?.message || 'Failed to update asset' },
        };
      }

      return { data: result as Asset };
    } catch (error) {
      return {
        error: {
          code: 'ASSET_UPDATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async addTimelineEntry(assetId: string, entry: any): Promise<ServiceResult<any>> {
    try {
      const { data, error } = await this.supabase
        .from('asset_timeline')
        .insert({
          asset_id: assetId,
          ...entry,
        })
        .select()
        .single();

      if (error) {
        return {
          error: { code: 'TIMELINE_ADD_FAILED', message: error?.message || 'Failed to add timeline entry' },
        };
      }

      return { data };
    } catch (error) {
      return {
        error: {
          code: 'TIMELINE_ADD_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async getTimeline(assetId: string): Promise<ServiceResult<any[]>> {
    try {
      const { data, error } = await this.supabase
        .from('asset_timeline')
        .select('*')
        .eq('asset_id', assetId)
        .order('created_at', { ascending: true });

      if (error) {
        return {
          error: { code: 'TIMELINE_GET_FAILED', message: error?.message || 'Failed to get timeline' },
        };
      }

      return { data: data || [] };
    } catch (error) {
      return {
        error: {
          code: 'TIMELINE_GET_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}

export const assetRepository = new AssetRepository();
