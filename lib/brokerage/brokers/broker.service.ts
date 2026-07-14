// lib/brokerage/brokers/broker.service.ts
// Broker Service — Persistence Layer

import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/platform/events/logger.service";
import { ServiceResult } from "@/lib/platform/types";
import { CreateBrokerParams, UpdateBrokerParams, Broker } from './broker.types';

export class BrokerService {
  private supabase = supabase;

  async create(params: CreateBrokerParams, entityId: string): Promise<ServiceResult<Broker>> {
    try {
      const { data, error } = await this.supabase
        .from('brokers')
        .insert({
          entity_id: entityId,
          company_id: params.company_id,
          name: params.name,
          email: params.email,
          phone: params.phone,
          employee_number: params.employee_number,
          commission_rate: params.commission_rate,
          commission_type: params.commission_type || 'percentage',
          status: 'active',
        })
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'BROKER_CREATE_FAILED', message: error?.message || 'Failed to create broker' },
        };
      }

      return { data: data as Broker };
    } catch (error) {
      return {
        error: {
          code: 'BROKER_CREATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async get(id: string): Promise<ServiceResult<Broker>> {
    try {
      const { data, error } = await this.supabase
        .from('brokers')
        .select('*, company:broker_companies(name)')
        .eq('id', id)
        .single();

      if (error || !data) {
        return {
          error: { code: 'BROKER_NOT_FOUND', message: error?.message || 'Broker not found' },
        };
      }

      return { data: data as Broker };
    } catch (error) {
      return {
        error: {
          code: 'BROKER_GET_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async list(entityId: string, options?: { status?: string; company_id?: string }): Promise<ServiceResult<Broker[]>> {
    try {
      let query = this.supabase
        .from('brokers')
        .select('*, company:broker_companies(name)')
        .eq('entity_id', entityId)
        .order('name', { ascending: true });

      if (options?.status) {
        query = query.eq('status', options.status);
      }

      if (options?.company_id) {
        query = query.eq('company_id', options.company_id);
      }

      const { data, error } = await query;

      if (error) {
        return {
          error: { code: 'BROKER_LIST_FAILED', message: error.message },
        };
      }

      return { data: data as Broker[] };
    } catch (error) {
      return {
        error: {
          code: 'BROKER_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async update(id: string, params: UpdateBrokerParams): Promise<ServiceResult<Broker>> {
    try {
      const updatePayload: Partial<Broker> = {};

      if (params.name !== undefined) updatePayload.name = params.name;
      if (params.company_id !== undefined) updatePayload.company_id = params.company_id;
      if (params.email !== undefined) updatePayload.email = params.email;
      if (params.phone !== undefined) updatePayload.phone = params.phone;
      if (params.employee_number !== undefined) updatePayload.employee_number = params.employee_number;
      if (params.commission_rate !== undefined) updatePayload.commission_rate = params.commission_rate;
      if (params.commission_type !== undefined) updatePayload.commission_type = params.commission_type;
      if (params.status !== undefined) updatePayload.status = params.status;

      const { data, error } = await this.supabase
        .from('brokers')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'BROKER_UPDATE_FAILED', message: error?.message || 'Failed to update broker' },
        };
      }

      return { data: data as Broker };
    } catch (error) {
      return {
        error: {
          code: 'BROKER_UPDATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async archive(id: string): Promise<ServiceResult<{ success: boolean }>> {
    try {
      const { error } = await this.supabase
        .from('brokers')
        .update({ status: 'inactive' })
        .eq('id', id);

      if (error) {
        return {
          error: { code: 'BROKER_ARCHIVE_FAILED', message: error.message },
        };
      }

      return { data: { success: true } };
    } catch (error) {
      return {
        error: {
          code: 'BROKER_ARCHIVE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}

export const brokerService = new BrokerService();
