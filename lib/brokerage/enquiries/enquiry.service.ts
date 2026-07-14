// lib/brokerage/enquiries/enquiry.service.ts
// Enquiry Service — Persistence Layer

import { supabase } from "@/lib/supabase";
import { ServiceResult } from "@/lib/platform/types";
import { CreateEnquiryParams, UpdateEnquiryParams, Enquiry } from './enquiry.types';

export class EnquiryService {
  private supabase = supabase;

  async create(params: CreateEnquiryParams, entityId: string): Promise<ServiceResult<Enquiry>> {
    try {
      const { data, error } = await this.supabase
        .from('enquiries')
        .insert({
          entity_id: entityId,
          vacancy_id: params.vacancy_id,
          broker_id: params.broker_id,
          applicant_name: params.applicant_name,
          applicant_company: params.applicant_company,
          contact_email: params.contact_email,
          contact_phone: params.contact_phone,
          source: params.source,
          notes: params.notes,
          status: 'new',
        })
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'ENQUIRY_CREATE_FAILED', message: error?.message || 'Failed to create enquiry' },
        };
      }

      return { data: data as Enquiry };
    } catch (error) {
      return {
        error: {
          code: 'ENQUIRY_CREATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async get(id: string): Promise<ServiceResult<Enquiry>> {
    try {
      const { data, error } = await this.supabase
        .from('enquiries')
        .select('*, vacancy:vacancies(id, status, property_id)')
        .eq('id', id)
        .single();

      if (error || !data) {
        return {
          error: { code: 'ENQUIRY_NOT_FOUND', message: error?.message || 'Enquiry not found' },
        };
      }

      return { data: data as Enquiry };
    } catch (error) {
      return {
        error: {
          code: 'ENQUIRY_GET_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async listByVacancy(vacancyId: string): Promise<ServiceResult<Enquiry[]>> {
    try {
      const { data, error } = await this.supabase
        .from('enquiries')
        .select('*')
        .eq('vacancy_id', vacancyId)
        .order('created_at', { ascending: false });

      if (error) {
        return {
          error: { code: 'ENQUIRY_LIST_FAILED', message: error.message },
        };
      }

      return { data: data as Enquiry[] };
    } catch (error) {
      return {
        error: {
          code: 'ENQUIRY_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async update(id: string, params: UpdateEnquiryParams): Promise<ServiceResult<Enquiry>> {
    try {
      const updatePayload: Partial<Enquiry> = {};

      if (params.applicant_name !== undefined) updatePayload.applicant_name = params.applicant_name;
      if (params.applicant_company !== undefined) updatePayload.applicant_company = params.applicant_company;
      if (params.contact_email !== undefined) updatePayload.contact_email = params.contact_email;
      if (params.contact_phone !== undefined) updatePayload.contact_phone = params.contact_phone;
      if (params.status !== undefined) updatePayload.status = params.status;
      if (params.notes !== undefined) updatePayload.notes = params.notes;
      if (params.source !== undefined) updatePayload.source = params.source;

      const { data, error } = await this.supabase
        .from('enquiries')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'ENQUIRY_UPDATE_FAILED', message: error?.message || 'Failed to update enquiry' },
        };
      }

      return { data: data as Enquiry };
    } catch (error) {
      return {
        error: {
          code: 'ENQUIRY_UPDATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async convert(id: string): Promise<ServiceResult<Enquiry>> {
    try {
      const { data, error } = await this.supabase
        .from('enquiries')
        .update({ status: 'converted' })
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'ENQUIRY_CONVERT_FAILED', message: error?.message || 'Failed to convert enquiry' },
        };
      }

      return { data: data as Enquiry };
    } catch (error) {
      return {
        error: {
          code: 'ENQUIRY_CONVERT_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}

export const enquiryService = new EnquiryService();
