// lib/brokerage/vacancies/vacancy.service.ts
// Vacancy Service — CRUD operations

import { supabase } from "@/lib/supabase";
import { CreateVacancyParams, UpdateVacancyParams, Vacancy, VacancyAnalytics } from './vacancy.types';
import { publish } from "@/lib/platform/events";
import { logger } from "@/lib/platform/events/logger.service";

export class VacancyService {
  private supabase = supabase;

  async create(params: CreateVacancyParams): Promise<{ success: boolean; data?: Vacancy; error?: string }> {
    try {
      const { data: unit, error: unitError } = await this.supabase
        .from('units')
        .select('id, unit_number, property_id')
        .eq('id', params.unit_id)
        .single();

      if (unitError || !unit) {
        return { success: false, error: 'Unit not found' };
      }

      const { data, error } = await this.supabase
        .from('vacancies')
        .insert({
          property_id: params.property_id,
          unit_id: params.unit_id,
          lease_id: params.lease_id,
          vacancy_date: params.vacancy_date,
          expected_release_date: params.expected_release_date,
          reason: params.reason,
          listing_url: params.listing_url,
          brochure_url: params.brochure_url,
          status: 'active',
          marketing_status: 'not_started',
          enquiry_count: 0,
          viewing_count: 0,
          offer_count: 0,
          days_vacant: 0,
        })
        .select()
        .single();

      if (error || !data) {
        return { success: false, error: error?.message || 'Failed to create vacancy' };
      }

      await publish('vacancy.created', {
        correlationId: data.id,
        source: 'vacancy-service',
        version: '1.0',
        entity: {
          id: data.id,
          type: 'vacancy',
          tenantId: undefined,
          propertyId: params.property_id,
        },
        payload: {
          vacancy_id: data.id,
          property_id: params.property_id,
          unit_id: params.unit_id,
          vacancy_date: params.vacancy_date,
        },
      });

      logger.info(`✅ Vacancy created: ${data.id}`, { propertyId: params.property_id, unitId: params.unit_id });

      return { success: true, data: data as Vacancy };
    } catch (error) {
      logger.error('Vacancy creation error:', { error });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async get(id: string): Promise<{ success: boolean; data?: Vacancy; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('vacancies')
        .select(`
          *,
          property:properties(property_name),
          unit:units(unit_number)
        `)
        .eq('id', id)
        .single();

      if (error || !data) {
        return { success: false, error: error?.message || 'Vacancy not found' };
      }

      return { success: true, data: data as Vacancy };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async list(params: {
    status?: string;
    property_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ success: boolean; data?: Vacancy[]; total?: number; error?: string }> {
    try {
      let query = this.supabase
        .from('vacancies')
        .select(`
          *,
          property:properties(property_name),
          unit:units(unit_number)
        `, { count: 'exact' });

      if (params.status) {
        query = query.eq('status', params.status);
      }

      if (params.property_id) {
        query = query.eq('property_id', params.property_id);
      }

      query = query.order('created_at', { ascending: false });

      if (params.limit) {
        query = query.limit(params.limit);
      }

      if (params.offset) {
        query = query.range(params.offset, params.offset + (params.limit || 10) - 1);
      }

      const { data, error, count } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as Vacancy[], total: count || 0 };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async update(id: string, params: UpdateVacancyParams): Promise<{ success: boolean; data?: Vacancy; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('vacancies')
        .update({
          expected_release_date: params.expected_release_date,
          reason: params.reason,
          status: params.status,
          listing_url: params.listing_url,
          brochure_url: params.brochure_url,
          marketing_status: params.marketing_status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        return { success: false, error: error?.message || 'Failed to update vacancy' };
      }

      return { success: true, data: data as Vacancy };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getAnalytics(id: string): Promise<{ success: boolean; data?: VacancyAnalytics; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('vacancies')
        .select(`
          id,
          status,
          days_vacant,
          enquiry_count,
          viewing_count,
          offer_count,
          property:properties(property_name),
          unit:units(unit_number)
        `)
        .eq('id', id)
        .single();

      if (error || !data) {
        return { success: false, error: error?.message || 'Vacancy not found' };
      }

      const analytics: VacancyAnalytics = {
        id: data.id,
        property_name: data.property?.property_name || 'Unknown',
        unit_number: data.unit?.unit_number || 'Unknown',
        status: data.status,
        days_vacant: data.days_vacant || 0,
        enquiry_count: data.enquiry_count || 0,
        viewing_count: data.viewing_count || 0,
        offer_count: data.offer_count || 0,
        conversion_rate: data.enquiry_count > 0 ? (data.offer_count / data.enquiry_count) * 100 : 0,
      };

      return { success: true, data: analytics };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async incrementCounter(id: string, field: 'enquiry_count' | 'viewing_count' | 'offer_count'): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase.rpc('increment_vacancy_counter', {
        vacancy_id: id,
        column_name: field,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async markAsLeased(id: string, leaseId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('vacancies')
        .update({
          status: 'leased',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

export const vacancyService = new VacancyService();
