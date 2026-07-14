// lib/property-operations/repositories/work-order.repository.ts
// Work Order Repository — Persistence Abstraction

import { supabase } from "@/lib/supabase";
import { ServiceResult } from "@/lib/platform/types";
import { WorkOrder, CreateWorkOrderParams, UpdateWorkOrderParams } from '../work-orders/work-order.types';

export class WorkOrderRepository {
  private supabase = supabase;

  async create(data: any): Promise<ServiceResult<WorkOrder>> {
    try {
      const { data: result, error } = await this.supabase
        .from('work_orders')
        .insert(data)
        .select()
        .single();

      if (error || !result) {
        return {
          error: { code: 'WORK_ORDER_CREATE_FAILED', message: error?.message || 'Failed to create work order' },
        };
      }

      return { data: result as WorkOrder };
    } catch (error) {
      return {
        error: {
          code: 'WORK_ORDER_CREATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async findById(id: string): Promise<ServiceResult<WorkOrder>> {
    try {
      const { data, error } = await this.supabase
        .from('work_orders')
        .select('*, property:properties(property_name), unit:units(unit_number), tenant:tenants(tenant_name), asset:assets(name), supplier:suppliers(name)')
        .eq('id', id)
        .single();

      if (error || !data) {
        return {
          error: { code: 'WORK_ORDER_NOT_FOUND', message: error?.message || 'Work order not found' },
        };
      }

      return { data: data as WorkOrder };
    } catch (error) {
      return {
        error: {
          code: 'WORK_ORDER_GET_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async findByProperty(propertyId: string): Promise<ServiceResult<WorkOrder[]>> {
    try {
      const { data, error } = await this.supabase
        .from('work_orders')
        .select('*, property:properties(property_name)')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });

      if (error) {
        return {
          error: { code: 'WORK_ORDER_LIST_FAILED', message: error.message },
        };
      }

      return { data: data as WorkOrder[] };
    } catch (error) {
      return {
        error: {
          code: 'WORK_ORDER_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async findByTenant(tenantId: string): Promise<ServiceResult<WorkOrder[]>> {
    try {
      const { data, error } = await this.supabase
        .from('work_orders')
        .select('*, property:properties(property_name)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        return {
          error: { code: 'WORK_ORDER_LIST_FAILED', message: error.message },
        };
      }

      return { data: data as WorkOrder[] };
    } catch (error) {
      return {
        error: {
          code: 'WORK_ORDER_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async findBySupplier(supplierId: string): Promise<ServiceResult<WorkOrder[]>> {
    try {
      const { data, error } = await this.supabase
        .from('work_orders')
        .select('*, property:properties(property_name)')
        .eq('assigned_to', supplierId)
        .order('created_at', { ascending: false });

      if (error) {
        return {
          error: { code: 'WORK_ORDER_LIST_FAILED', message: error.message },
        };
      }

      return { data: data as WorkOrder[] };
    } catch (error) {
      return {
        error: {
          code: 'WORK_ORDER_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async findByEntity(entityId: string, options?: { status?: string; priority?: string; fromDate?: string; toDate?: string }): Promise<ServiceResult<WorkOrder[]>> {
    try {
      let query = this.supabase
        .from('work_orders')
        .select('*, property:properties(property_name), supplier:suppliers(name)')
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });

      if (options?.status) {
        query = query.eq('status', options.status);
      }

      if (options?.priority) {
        query = query.eq('priority', options.priority);
      }

      if (options?.fromDate) {
        query = query.gte('created_at', options.fromDate);
      }

      if (options?.toDate) {
        query = query.lte('created_at', options.toDate);
      }

      const { data, error } = await query;

      if (error) {
        return {
          error: { code: 'WORK_ORDER_LIST_FAILED', message: error.message },
        };
      }

      return { data: data as WorkOrder[] };
    } catch (error) {
      return {
        error: {
          code: 'WORK_ORDER_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async findByInspection(inspectionId: string): Promise<ServiceResult<WorkOrder[]>> {
    try {
      const { data, error } = await this.supabase
        .from('work_orders')
        .select('*, property:properties(property_name)')
        .eq('inspection_id', inspectionId)
        .order('created_at', { ascending: false });

      if (error) {
        return {
          error: { code: 'WORK_ORDER_LIST_FAILED', message: error.message },
        };
      }

      return { data: data as WorkOrder[] };
    } catch (error) {
      return {
        error: {
          code: 'WORK_ORDER_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async update(id: string, data: Partial<WorkOrder>): Promise<ServiceResult<WorkOrder>> {
    try {
      const { data: result, error } = await this.supabase
        .from('work_orders')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error || !result) {
        return {
          error: { code: 'WORK_ORDER_UPDATE_FAILED', message: error?.message || 'Failed to update work order' },
        };
      }

      return { data: result as WorkOrder };
    } catch (error) {
      return {
        error: {
          code: 'WORK_ORDER_UPDATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async addEvent(workOrderId: string, entry: any): Promise<ServiceResult<any>> {
    try {
      const { data, error } = await this.supabase
        .from('work_order_events')
        .insert({
          work_order_id: workOrderId,
          ...entry,
        })
        .select()
        .single();

      if (error) {
        return {
          error: { code: 'EVENT_ADD_FAILED', message: error?.message || 'Failed to add event' },
        };
      }

      return { data };
    } catch (error) {
      return {
        error: {
          code: 'EVENT_ADD_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async getEvents(workOrderId: string): Promise<ServiceResult<any[]>> {
    try {
      const { data, error } = await this.supabase
        .from('work_order_events')
        .select('*')
        .eq('work_order_id', workOrderId)
        .order('created_at', { ascending: true });

      if (error) {
        return {
          error: { code: 'EVENT_GET_FAILED', message: error?.message || 'Failed to get events' },
        };
      }

      return { data: data || [] };
    } catch (error) {
      return {
        error: {
          code: 'EVENT_GET_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}

export const workOrderRepository = new WorkOrderRepository();
