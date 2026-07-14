// lib/brokerage/viewings/viewing.service.ts
// Viewing Service — Persistence Layer

import { supabase } from "@/lib/supabase";
import { ServiceResult } from "@/lib/platform/types";
import { CreateViewingParams, UpdateViewingParams, Viewing } from './viewing.types';

export class ViewingService {
  private supabase = supabase;

  async create(params: CreateViewingParams, entityId: string): Promise<ServiceResult<Viewing>> {
    try {
      const attendeeNames = params.attendee_names || [];
      
      const { data, error } = await this.supabase
        .from('viewings')
        .insert({
          entity_id: entityId,
          enquiry_id: params.enquiry_id,
          vacancy_id: params.vacancy_id,
          broker_id: params.broker_id,
          viewing_date: params.viewing_date,
          duration_minutes: params.duration_minutes || 30,
          status: 'scheduled',
          attendee_names: attendeeNames,
          attendee_count: attendeeNames.length,
        })
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'VIEWING_CREATE_FAILED', message: error?.message || 'Failed to create viewing' },
        };
      }

      return { data: data as Viewing };
    } catch (error) {
      return {
        error: {
          code: 'VIEWING_CREATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async get(id: string): Promise<ServiceResult<Viewing>> {
    try {
      const { data, error } = await this.supabase
        .from('viewings')
        .select('*, enquiry:enquiries(applicant_name), vacancy:vacancies(id, status)')
        .eq('id', id)
        .single();

      if (error || !data) {
        return {
          error: { code: 'VIEWING_NOT_FOUND', message: error?.message || 'Viewing not found' },
        };
      }

      return { data: data as Viewing };
    } catch (error) {
      return {
        error: {
          code: 'VIEWING_GET_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async listByVacancy(vacancyId: string): Promise<ServiceResult<Viewing[]>> {
    try {
      const { data, error } = await this.supabase
        .from('viewings')
        .select('*, enquiry:enquiries(applicant_name)')
        .eq('vacancy_id', vacancyId)
        .order('viewing_date', { ascending: true });

      if (error) {
        return {
          error: { code: 'VIEWING_LIST_FAILED', message: error.message },
        };
      }

      return { data: data as Viewing[] };
    } catch (error) {
      return {
        error: {
          code: 'VIEWING_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async listByDate(entityId: string, date: string): Promise<ServiceResult<Viewing[]>> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await this.supabase
        .from('viewings')
        .select('*, enquiry:enquiries(applicant_name)')
        .eq('entity_id', entityId)
        .gte('viewing_date', startOfDay.toISOString())
        .lte('viewing_date', endOfDay.toISOString())
        .order('viewing_date', { ascending: true });

      if (error) {
        return {
          error: { code: 'VIEWING_LIST_FAILED', message: error.message },
        };
      }

      return { data: data as Viewing[] };
    } catch (error) {
      return {
        error: {
          code: 'VIEWING_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async update(id: string, params: UpdateViewingParams): Promise<ServiceResult<Viewing>> {
    try {
      const updatePayload: Partial<Viewing> = {};

      if (params.viewing_date !== undefined) updatePayload.viewing_date = params.viewing_date;
      if (params.duration_minutes !== undefined) updatePayload.duration_minutes = params.duration_minutes;
      if (params.status !== undefined) updatePayload.status = params.status;
      if (params.attendee_names !== undefined) {
        updatePayload.attendee_names = params.attendee_names;
        updatePayload.attendee_count = params.attendee_names.length;
      }
      if (params.outcome !== undefined) updatePayload.outcome = params.outcome;
      if (params.feedback !== undefined) updatePayload.feedback = params.feedback;
      if (params.follow_up_date !== undefined) updatePayload.follow_up_date = params.follow_up_date;

      const { data, error } = await this.supabase
        .from('viewings')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'VIEWING_UPDATE_FAILED', message: error?.message || 'Failed to update viewing' },
        };
      }

      return { data: data as Viewing };
    } catch (error) {
      return {
        error: {
          code: 'VIEWING_UPDATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async confirm(id: string): Promise<ServiceResult<Viewing>> {
    try {
      const { data, error } = await this.supabase
        .from('viewings')
        .update({ status: 'confirmed' })
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'VIEWING_CONFIRM_FAILED', message: error?.message || 'Failed to confirm viewing' },
        };
      }

      return { data: data as Viewing };
    } catch (error) {
      return {
        error: {
          code: 'VIEWING_CONFIRM_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async complete(id: string, outcome: string, feedback?: string): Promise<ServiceResult<Viewing>> {
    try {
      const { data, error } = await this.supabase
        .from('viewings')
        .update({ 
          status: 'completed',
          outcome,
          feedback,
        })
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'VIEWING_COMPLETE_FAILED', message: error?.message || 'Failed to complete viewing' },
        };
      }

      return { data: data as Viewing };
    } catch (error) {
      return {
        error: {
          code: 'VIEWING_COMPLETE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async cancel(id: string, reason?: string): Promise<ServiceResult<Viewing>> {
    try {
      const { data, error } = await this.supabase
        .from('viewings')
        .update({ 
          status: 'cancelled',
          feedback: reason || 'Cancelled',
        })
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'VIEWING_CANCEL_FAILED', message: error?.message || 'Failed to cancel viewing' },
        };
      }

      return { data: data as Viewing };
    } catch (error) {
      return {
        error: {
          code: 'VIEWING_CANCEL_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}

export const viewingService = new ViewingService();
