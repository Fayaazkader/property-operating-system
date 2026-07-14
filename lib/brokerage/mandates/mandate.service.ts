// lib/brokerage/mandates/mandate.service.ts
// Mandate Service — Persistence Layer

import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/platform/events/logger.service";
import { ServiceResult } from "@/lib/platform/types";
import { CreateMandateParams, UpdateMandateParams, Mandate } from './mandate.types';

export class MandateService {
  private supabase = supabase;

  async create(params: CreateMandateParams, entityId: string): Promise<ServiceResult<Mandate>> {
    try {
      const { data, error } = await this.supabase
        .from('broker_mandates')
        .insert({
          entity_id: entityId,
          broker_id: params.broker_id,
          vacancy_id: params.vacancy_id,
          mandate_date: params.mandate_date,
          expiry_date: params.expiry_date,
          commission_rate: params.commission_rate,
          commission_type: params.commission_type || 'percentage',
          terms: params.terms,
          exclusive: params.exclusive || false,
          status: 'pending',
          mandate_url: params.mandate_url,
        })
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'MANDATE_CREATE_FAILED', message: error?.message || 'Failed to create mandate' },
        };
      }

      return { data: data as Mandate };
    } catch (error) {
      return {
        error: {
          code: 'MANDATE_CREATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async get(id: string): Promise<ServiceResult<Mandate>> {
    try {
      const { data, error } = await this.supabase
        .from('broker_mandates')
        .select('*, broker:brokers(name), vacancy:vacancies(id, status)')
        .eq('id', id)
        .single();

      if (error || !data) {
        return {
          error: { code: 'MANDATE_NOT_FOUND', message: error?.message || 'Mandate not found' },
        };
      }

      return { data: data as Mandate };
    } catch (error) {
      return {
        error: {
          code: 'MANDATE_GET_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async list(entityId: string, options?: { status?: string; broker_id?: string }): Promise<ServiceResult<Mandate[]>> {
    try {
      let query = this.supabase
        .from('broker_mandates')
        .select('*, broker:brokers(name), vacancy:vacancies(id, status)')
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });

      if (options?.status) {
        query = query.eq('status', options.status);
      }

      if (options?.broker_id) {
        query = query.eq('broker_id', options.broker_id);
      }

      const { data, error } = await query;

      if (error) {
        return {
          error: { code: 'MANDATE_LIST_FAILED', message: error.message },
        };
      }

      return { data: data as Mandate[] };
    } catch (error) {
      return {
        error: {
          code: 'MANDATE_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async update(id: string, params: UpdateMandateParams): Promise<ServiceResult<Mandate>> {
    try {
      const updatePayload: Partial<Mandate> = {};

      if (params.expiry_date !== undefined) updatePayload.expiry_date = params.expiry_date;
      if (params.commission_rate !== undefined) updatePayload.commission_rate = params.commission_rate;
      if (params.commission_type !== undefined) updatePayload.commission_type = params.commission_type;
      if (params.terms !== undefined) updatePayload.terms = params.terms;
      if (params.exclusive !== undefined) updatePayload.exclusive = params.exclusive;
      if (params.status !== undefined) updatePayload.status = params.status;
      if (params.mandate_url !== undefined) updatePayload.mandate_url = params.mandate_url;
      if (params.signed_mandate_url !== undefined) updatePayload.signed_mandate_url = params.signed_mandate_url;

      const { data, error } = await this.supabase
        .from('broker_mandates')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'MANDATE_UPDATE_FAILED', message: error?.message || 'Failed to update mandate' },
        };
      }

      return { data: data as Mandate };
    } catch (error) {
      return {
        error: {
          code: 'MANDATE_UPDATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async accept(id: string): Promise<ServiceResult<Mandate>> {
    try {
      const { data, error } = await this.supabase
        .from('broker_mandates')
        .update({ status: 'accepted' })
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'MANDATE_ACCEPT_FAILED', message: error?.message || 'Failed to accept mandate' },
        };
      }

      return { data: data as Mandate };
    } catch (error) {
      return {
        error: {
          code: 'MANDATE_ACCEPT_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async decline(id: string): Promise<ServiceResult<Mandate>> {
    try {
      const { data, error } = await this.supabase
        .from('broker_mandates')
        .update({ status: 'declined' })
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'MANDATE_DECLINE_FAILED', message: error?.message || 'Failed to decline mandate' },
        };
      }

      return { data: data as Mandate };
    } catch (error) {
      return {
        error: {
          code: 'MANDATE_DECLINE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async complete(id: string): Promise<ServiceResult<Mandate>> {
    try {
      const { data, error } = await this.supabase
        .from('broker_mandates')
        .update({ status: 'completed' })
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'MANDATE_COMPLETE_FAILED', message: error?.message || 'Failed to complete mandate' },
        };
      }

      return { data: data as Mandate };
    } catch (error) {
      return {
        error: {
          code: 'MANDATE_COMPLETE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}

export const mandateService = new MandateService();
