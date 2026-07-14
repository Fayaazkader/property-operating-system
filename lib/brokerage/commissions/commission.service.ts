// lib/brokerage/commissions/commission.service.ts
// Commission Service — Pure Persistence (No Business Logic)

import { supabase } from "@/lib/supabase";
import { ServiceResult } from "@/lib/platform/types";
import { CreateCommissionParams, UpdateCommissionParams, Commission } from './commission.types';

export class CommissionService {
  private supabase = supabase;

  async create(params: CreateCommissionParams, entityId: string, calculationSnapshot: any): Promise<ServiceResult<Commission>> {
    try {
      const { data, error } = await this.supabase
        .from('broker_commissions')
        .insert({
          entity_id: entityId,
          broker_id: params.broker_id,
          lease_id: params.lease_id,
          mandate_id: params.mandate_id,
          vacancy_id: params.vacancy_id,
          commission_type: params.commission_type,
          commission_rate: params.commission_rate,
          calculation_snapshot: calculationSnapshot,
          total_commission: calculationSnapshot.outputs.total_commission,
          split_percentage: params.split_percentage || 100,
          status: 'pending_calculation',
          notes: params.notes,
        })
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'COMMISSION_CREATE_FAILED', message: error?.message || 'Failed to create commission' },
        };
      }

      return { data: data as Commission };
    } catch (error) {
      return {
        error: {
          code: 'COMMISSION_CREATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async get(id: string): Promise<ServiceResult<Commission>> {
    try {
      const { data, error } = await this.supabase
        .from('broker_commissions')
        .select(`
          *,
          broker:brokers(name, company:broker_companies(name)),
          lease:leases(tenant_name, monthly_rental),
          mandate:broker_mandates(id, commission_rate)
        `)
        .eq('id', id)
        .single();

      if (error || !data) {
        return {
          error: { code: 'COMMISSION_NOT_FOUND', message: error?.message || 'Commission not found' },
        };
      }

      return { data: data as Commission };
    } catch (error) {
      return {
        error: {
          code: 'COMMISSION_GET_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async listByBroker(brokerId: string): Promise<ServiceResult<Commission[]>> {
    try {
      const { data, error } = await this.supabase
        .from('broker_commissions')
        .select('*, lease:leases(tenant_name, monthly_rental)')
        .eq('broker_id', brokerId)
        .order('created_at', { ascending: false });

      if (error) {
        return {
          error: { code: 'COMMISSION_LIST_FAILED', message: error.message },
        };
      }

      return { data: data as Commission[] };
    } catch (error) {
      return {
        error: {
          code: 'COMMISSION_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async listByLease(leaseId: string): Promise<ServiceResult<Commission[]>> {
    try {
      const { data, error } = await this.supabase
        .from('broker_commissions')
        .select('*, broker:brokers(name, company:broker_companies(name))')
        .eq('lease_id', leaseId)
        .order('created_at', { ascending: false });

      if (error) {
        return {
          error: { code: 'COMMISSION_LIST_FAILED', message: error.message },
        };
      }

      return { data: data as Commission[] };
    } catch (error) {
      return {
        error: {
          code: 'COMMISSION_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async listByEntity(entityId: string, options?: { status?: string }): Promise<ServiceResult<Commission[]>> {
    try {
      let query = this.supabase
        .from('broker_commissions')
        .select('*, broker:brokers(name, company:broker_companies(name)), lease:leases(tenant_name)')
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });

      if (options?.status) {
        query = query.eq('status', options.status);
      }

      const { data, error } = await query;

      if (error) {
        return {
          error: { code: 'COMMISSION_LIST_FAILED', message: error.message },
        };
      }

      return { data: data as Commission[] };
    } catch (error) {
      return {
        error: {
          code: 'COMMISSION_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async update(id: string, params: UpdateCommissionParams): Promise<ServiceResult<Commission>> {
    try {
      const updatePayload: Partial<Commission> = {};

      if (params.status !== undefined) updatePayload.status = params.status;
      if (params.notes !== undefined) updatePayload.notes = params.notes;

      const { data, error } = await this.supabase
        .from('broker_commissions')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'COMMISSION_UPDATE_FAILED', message: error?.message || 'Failed to update commission' },
        };
      }

      return { data: data as Commission };
    } catch (error) {
      return {
        error: {
          code: 'COMMISSION_UPDATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ============================================================
  // STATUS TRANSITIONS (Engine will call these)
  // ============================================================

  async approve(id: string, approvedBy: string): Promise<ServiceResult<Commission>> {
    try {
      const { data, error } = await this.supabase
        .from('broker_commissions')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: approvedBy,
        })
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'COMMISSION_APPROVE_FAILED', message: error?.message || 'Failed to approve commission' },
        };
      }

      return { data: data as Commission };
    } catch (error) {
      return {
        error: {
          code: 'COMMISSION_APPROVE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async requestPayment(id: string, paymentRequestId: string): Promise<ServiceResult<Commission>> {
    try {
      const { data, error } = await this.supabase
        .from('broker_commissions')
        .update({
          status: 'payment_requested',
          payment_request_id: paymentRequestId,
          payment_requested_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'COMMISSION_PAYMENT_REQUEST_FAILED', message: error?.message || 'Failed to request payment' },
        };
      }

      return { data: data as Commission };
    } catch (error) {
      return {
        error: {
          code: 'COMMISSION_PAYMENT_REQUEST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async decline(id: string, reason?: string): Promise<ServiceResult<Commission>> {
    try {
      const { data, error } = await this.supabase
        .from('broker_commissions')
        .update({
          status: 'declined',
          notes: reason || 'Commission declined',
        })
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'COMMISSION_DECLINE_FAILED', message: error?.message || 'Failed to decline commission' },
        };
      }

      return { data: data as Commission };
    } catch (error) {
      return {
        error: {
          code: 'COMMISSION_DECLINE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}

export const commissionService = new CommissionService();
