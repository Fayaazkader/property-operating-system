// lib/property-operations/repositories/supplier.repository.ts
// Supplier Repository — Persistence Abstraction

import { supabase } from "@/lib/supabase";
import { ServiceResult } from "@/lib/platform/types";
import { Supplier, CreateSupplierParams, UpdateSupplierParams } from '../suppliers/supplier.types';

export class SupplierRepository {
  private supabase = supabase;

  async create(data: any): Promise<ServiceResult<Supplier>> {
    try {
      const { data: result, error } = await this.supabase
        .from('suppliers')
        .insert(data)
        .select()
        .single();

      if (error || !result) {
        return {
          error: { code: 'SUPPLIER_CREATE_FAILED', message: error?.message || 'Failed to create supplier' },
        };
      }

      return { data: result as Supplier };
    } catch (error) {
      return {
        error: {
          code: 'SUPPLIER_CREATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async findById(id: string): Promise<ServiceResult<Supplier>> {
    try {
      const { data, error } = await this.supabase
        .from('suppliers')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return {
          error: { code: 'SUPPLIER_NOT_FOUND', message: error?.message || 'Supplier not found' },
        };
      }

      return { data: data as Supplier };
    } catch (error) {
      return {
        error: {
          code: 'SUPPLIER_GET_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async findByEntity(entityId: string, options?: { status?: string; category?: string }): Promise<ServiceResult<Supplier[]>> {
    try {
      let query = this.supabase
        .from('suppliers')
        .select('*')
        .eq('entity_id', entityId)
        .order('name', { ascending: true });

      if (options?.status) {
        query = query.eq('status', options.status);
      }

      if (options?.category) {
        query = query.contains('categories', [options.category]);
      }

      const { data, error } = await query;

      if (error) {
        return {
          error: { code: 'SUPPLIER_LIST_FAILED', message: error.message },
        };
      }

      return { data: data as Supplier[] };
    } catch (error) {
      return {
        error: {
          code: 'SUPPLIER_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async update(id: string, data: Partial<Supplier>): Promise<ServiceResult<Supplier>> {
    try {
      const { data: result, error } = await this.supabase
        .from('suppliers')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error || !result) {
        return {
          error: { code: 'SUPPLIER_UPDATE_FAILED', message: error?.message || 'Failed to update supplier' },
        };
      }

      return { data: result as Supplier };
    } catch (error) {
      return {
        error: {
          code: 'SUPPLIER_UPDATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}

export const supplierRepository = new SupplierRepository();
