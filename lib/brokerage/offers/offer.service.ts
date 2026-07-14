// lib/brokerage/offers/offer.service.ts
// Offer Service — Pure Persistence (No Business Logic)

import { supabase } from "@/lib/supabase";
import { ServiceResult } from "@/lib/platform/types";
import { CreateOfferParams, UpdateOfferParams, Offer } from './offer.types';

export class OfferService {
  private supabase = supabase;

  async create(params: CreateOfferParams, entityId: string): Promise<ServiceResult<Offer>> {
    try {
      const { data, error } = await this.supabase
        .from('offers')
        .insert({
          entity_id: entityId,
          vacancy_id: params.vacancy_id,
          enquiry_id: params.enquiry_id,
          broker_id: params.broker_id,
          offer_date: params.offer_date,
          proposed_rental: params.proposed_rental,
          proposed_deposit: params.proposed_deposit,
          proposed_term: params.proposed_term,
          proposed_commencement: params.proposed_commencement,
          special_conditions: params.special_conditions,
          status: 'received',
        })
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'OFFER_CREATE_FAILED', message: error?.message || 'Failed to create offer' },
        };
      }

      return { data: data as Offer };
    } catch (error) {
      return {
        error: {
          code: 'OFFER_CREATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async get(id: string): Promise<ServiceResult<Offer>> {
    try {
      const { data, error } = await this.supabase
        .from('offers')
        .select(`
          *,
          vacancy:vacancies(id, status, property_id),
          enquiry:enquiries(applicant_name, applicant_company, contact_email),
          broker:brokers(name, company:broker_companies(name))
        `)
        .eq('id', id)
        .single();

      if (error || !data) {
        return {
          error: { code: 'OFFER_NOT_FOUND', message: error?.message || 'Offer not found' },
        };
      }

      return { data: data as Offer };
    } catch (error) {
      return {
        error: {
          code: 'OFFER_GET_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async listByVacancy(vacancyId: string): Promise<ServiceResult<Offer[]>> {
    try {
      const { data, error } = await this.supabase
        .from('offers')
        .select('*, broker:brokers(name)')
        .eq('vacancy_id', vacancyId)
        .order('created_at', { ascending: false });

      if (error) {
        return {
          error: { code: 'OFFER_LIST_FAILED', message: error.message },
        };
      }

      return { data: data as Offer[] };
    } catch (error) {
      return {
        error: {
          code: 'OFFER_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async update(id: string, params: UpdateOfferParams): Promise<ServiceResult<Offer>> {
    try {
      const updatePayload: Partial<Offer> = {};

      if (params.proposed_rental !== undefined) updatePayload.proposed_rental = params.proposed_rental;
      if (params.proposed_deposit !== undefined) updatePayload.proposed_deposit = params.proposed_deposit;
      if (params.proposed_term !== undefined) updatePayload.proposed_term = params.proposed_term;
      if (params.proposed_commencement !== undefined) updatePayload.proposed_commencement = params.proposed_commencement;
      if (params.special_conditions !== undefined) updatePayload.special_conditions = params.special_conditions;
      if (params.status !== undefined) updatePayload.status = params.status;
      if (params.final_rental !== undefined) updatePayload.final_rental = params.final_rental;
      if (params.final_terms !== undefined) updatePayload.final_terms = params.final_terms;

      const { data, error } = await this.supabase
        .from('offers')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'OFFER_UPDATE_FAILED', message: error?.message || 'Failed to update offer' },
        };
      }

      return { data: data as Offer };
    } catch (error) {
      return {
        error: {
          code: 'OFFER_UPDATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}

export const offerService = new OfferService();
