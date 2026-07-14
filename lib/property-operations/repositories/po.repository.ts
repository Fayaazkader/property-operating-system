// lib/property-operations/repositories/po.repository.ts
// Purchase Order Repository — Persistence Abstraction

import { supabase } from "@/lib/supabase";
import { ServiceResult } from "@/lib/platform/types";
import { PurchaseOrder, CreatePurchaseOrderParams, UpdatePurchaseOrderParams } from '../purchase-orders/po.types';

export class PurchaseOrderRepository {
  private supabase = supabase;

  async create(data: any): Promise<ServiceResult<PurchaseOrder>> {
    try {
      const { data: result, error } = await this.supabase
        .from('purchase_orders')
        .insert(data)
        .select()
        .single();

      if (error || !result) {
        return {
          error: { code: 'PO_CREATE_FAILED', message: error?.message || 'Failed to create purchase order' },
        };
      }

      return { data: result as PurchaseOrder };
    } catch (error) {
      return {
        error: {
          code: 'PO_CREATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async findById(id: string): Promise<ServiceResult<PurchaseOrder>> {
    try {
      const { data, error } = await this.supabase
        .from('purchase_orders')
        .select('*, work_order:work_orders(title), supplier:suppliers(name)')
        .eq('id', id)
        .single();

      if (error || !data) {
        return {
          error: { code: 'PO_NOT_FOUND', message: error?.message || 'Purchase order not found' },
        };
      }

      return { data: data as PurchaseOrder };
    } catch (error) {
      return {
        error: {
          code: 'PO_GET_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async findByWorkOrder(workOrderId: string): Promise<ServiceResult<PurchaseOrder[]>> {
    try {
      const { data, error } = await this.supabase
        .from('purchase_orders')
        .select('*')
        .eq('work_order_id', workOrderId)
        .order('created_at', { ascending: false });

      if (error) {
        return {
          error: { code: 'PO_LIST_FAILED', message: error.message },
        };
      }

      return { data: data as PurchaseOrder[] };
    } catch (error) {
      return {
        error: {
          code: 'PO_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async findBySupplier(supplierId: string): Promise<ServiceResult<PurchaseOrder[]>> {
    try {
      const { data, error } = await this.supabase
        .from('purchase_orders')
        .select('*')
        .eq('supplier_id', supplierId)
        .order('created_at', { ascending: false });

      if (error) {
        return {
          error: { code: 'PO_LIST_FAILED', message: error.message },
        };
      }

      return { data: data as PurchaseOrder[] };
    } catch (error) {
      return {
        error: {
          code: 'PO_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async findByEntity(entityId: string, options?: { status?: string }): Promise<ServiceResult<PurchaseOrder[]>> {
    try {
      let query = this.supabase
        .from('purchase_orders')
        .select('*, work_order:work_orders(title), supplier:suppliers(name)')
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });

      if (options?.status) {
        query = query.eq('status', options.status);
      }

      const { data, error } = await query;

      if (error) {
        return {
          error: { code: 'PO_LIST_FAILED', message: error.message },
        };
      }

      return { data: data as PurchaseOrder[] };
    } catch (error) {
      return {
        error: {
          code: 'PO_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async update(id: string, data: Partial<PurchaseOrder>): Promise<ServiceResult<PurchaseOrder>> {
    try {
      const { data: result, error } = await this.supabase
        .from('purchase_orders')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error || !result) {
        return {
          error: { code: 'PO_UPDATE_FAILED', message: error?.message || 'Failed to update purchase order' },
        };
      }

      return { data: result as PurchaseOrder };
    } catch (error) {
      return {
        error: {
          code: 'PO_UPDATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}

export const purchaseOrderRepository = new PurchaseOrderRepository();
