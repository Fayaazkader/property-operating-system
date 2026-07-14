// lib/property-operations/repositories/inspection.repository.ts
// Inspection Repository — Persistence Abstraction

import { supabase } from "@/lib/supabase";
import { ServiceResult } from "@/lib/platform/types";
import { Inspection, CreateInspectionParams, UpdateInspectionParams } from '../inspections/inspection.types';

export class InspectionRepository {
  private supabase = supabase;

  async create(data: any): Promise<ServiceResult<Inspection>> {
    try {
      const { data: result, error } = await this.supabase
        .from('inspections')
        .insert(data)
        .select()
        .single();

      if (error || !result) {
        return {
          error: { code: 'INSPECTION_CREATE_FAILED', message: error?.message || 'Failed to create inspection' },
        };
      }

      return { data: result as Inspection };
    } catch (error) {
      return {
        error: {
          code: 'INSPECTION_CREATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async findById(id: string): Promise<ServiceResult<Inspection>> {
    try {
      const { data, error } = await this.supabase
        .from('inspections')
        .select('*, property:properties(property_name), asset:assets(name), unit:units(unit_number)')
        .eq('id', id)
        .single();

      if (error || !data) {
        return {
          error: { code: 'INSPECTION_NOT_FOUND', message: error?.message || 'Inspection not found' },
        };
      }

      return { data: data as Inspection };
    } catch (error) {
      return {
        error: {
          code: 'INSPECTION_GET_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async findByProperty(propertyId: string): Promise<ServiceResult<Inspection[]>> {
    try {
      const { data, error } = await this.supabase
        .from('inspections')
        .select('*')
        .eq('property_id', propertyId)
        .order('scheduled_date', { ascending: true });

      if (error) {
        return {
          error: { code: 'INSPECTION_LIST_FAILED', message: error.message },
        };
      }

      return { data: data as Inspection[] };
    } catch (error) {
      return {
        error: {
          code: 'INSPECTION_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async findByEntity(entityId: string, options?: { status?: string; fromDate?: string; toDate?: string }): Promise<ServiceResult<Inspection[]>> {
    try {
      let query = this.supabase
        .from('inspections')
        .select('*, property:properties(property_name)')
        .eq('entity_id', entityId)
        .order('scheduled_date', { ascending: true });

      if (options?.status) {
        query = query.eq('status', options.status);
      }

      if (options?.fromDate) {
        query = query.gte('scheduled_date', options.fromDate);
      }

      if (options?.toDate) {
        query = query.lte('scheduled_date', options.toDate);
      }

      const { data, error } = await query;

      if (error) {
        return {
          error: { code: 'INSPECTION_LIST_FAILED', message: error.message },
        };
      }

      return { data: data as Inspection[] };
    } catch (error) {
      return {
        error: {
          code: 'INSPECTION_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async update(id: string, data: Partial<Inspection>): Promise<ServiceResult<Inspection>> {
    try {
      const { data: result, error } = await this.supabase
        .from('inspections')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error || !result) {
        return {
          error: { code: 'INSPECTION_UPDATE_FAILED', message: error?.message || 'Failed to update inspection' },
        };
      }

      return { data: result as Inspection };
    } catch (error) {
      return {
        error: {
          code: 'INSPECTION_UPDATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}

export const inspectionRepository = new InspectionRepository();
