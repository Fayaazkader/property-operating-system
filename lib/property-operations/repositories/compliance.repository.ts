// lib/property-operations/repositories/compliance.repository.ts
// Compliance Repository — Persistence Abstraction

import { supabase } from "@/lib/supabase";
import { ServiceResult } from "@/lib/platform/types";
import { ComplianceItem, CreateComplianceParams, UpdateComplianceParams } from '../compliance/compliance.types';

export class ComplianceRepository {
  private supabase = supabase;

  async create(data: any): Promise<ServiceResult<ComplianceItem>> {
    try {
      const { data: result, error } = await this.supabase
        .from('compliance_items')
        .insert(data)
        .select()
        .single();

      if (error || !result) {
        return {
          error: { code: 'COMPLIANCE_CREATE_FAILED', message: error?.message || 'Failed to create compliance item' },
        };
      }

      return { data: result as ComplianceItem };
    } catch (error) {
      return {
        error: {
          code: 'COMPLIANCE_CREATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async findById(id: string): Promise<ServiceResult<ComplianceItem>> {
    try {
      const { data, error } = await this.supabase
        .from('compliance_items')
        .select('*, property:properties(property_name), asset:assets(name)')
        .eq('id', id)
        .single();

      if (error || !data) {
        return {
          error: { code: 'COMPLIANCE_NOT_FOUND', message: error?.message || 'Compliance item not found' },
        };
      }

      return { data: data as ComplianceItem };
    } catch (error) {
      return {
        error: {
          code: 'COMPLIANCE_GET_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async findByProperty(propertyId: string): Promise<ServiceResult<ComplianceItem[]>> {
    try {
      const { data, error } = await this.supabase
        .from('compliance_items')
        .select('*')
        .eq('property_id', propertyId)
        .order('expiry_date', { ascending: true });

      if (error) {
        return {
          error: { code: 'COMPLIANCE_LIST_FAILED', message: error.message },
        };
      }

      return { data: data as ComplianceItem[] };
    } catch (error) {
      return {
        error: {
          code: 'COMPLIANCE_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async findByEntity(entityId: string, options?: { status?: string; type?: string }): Promise<ServiceResult<ComplianceItem[]>> {
    try {
      let query = this.supabase
        .from('compliance_items')
        .select('*, property:properties(property_name)')
        .eq('entity_id', entityId)
        .order('expiry_date', { ascending: true });

      if (options?.status) {
        query = query.eq('status', options.status);
      }

      if (options?.type) {
        query = query.eq('type', options.type);
      }

      const { data, error } = await query;

      if (error) {
        return {
          error: { code: 'COMPLIANCE_LIST_FAILED', message: error.message },
        };
      }

      return { data: data as ComplianceItem[] };
    } catch (error) {
      return {
        error: {
          code: 'COMPLIANCE_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async findExpiringSoon(entityId: string, days: number = 30): Promise<ServiceResult<ComplianceItem[]>> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const future = new Date();
      future.setDate(future.getDate() + days);
      const futureStr = future.toISOString().split('T')[0];

      const { data, error } = await this.supabase
        .from('compliance_items')
        .select('*, property:properties(property_name)')
        .eq('entity_id', entityId)
        .eq('status', 'active')
        .lte('expiry_date', futureStr)
        .gte('expiry_date', today)
        .order('expiry_date', { ascending: true });

      if (error) {
        return {
          error: { code: 'COMPLIANCE_LIST_FAILED', message: error.message },
        };
      }

      return { data: data as ComplianceItem[] };
    } catch (error) {
      return {
        error: {
          code: 'COMPLIANCE_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async update(id: string, data: Partial<ComplianceItem>): Promise<ServiceResult<ComplianceItem>> {
    try {
      const { data: result, error } = await this.supabase
        .from('compliance_items')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error || !result) {
        return {
          error: { code: 'COMPLIANCE_UPDATE_FAILED', message: error?.message || 'Failed to update compliance item' },
        };
      }

      return { data: result as ComplianceItem };
    } catch (error) {
      return {
        error: {
          code: 'COMPLIANCE_UPDATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}

export const complianceRepository = new ComplianceRepository();
