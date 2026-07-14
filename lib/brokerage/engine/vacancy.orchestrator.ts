// lib/brokerage/engine/vacancy.orchestrator.ts
// Vacancy Orchestrator — Owns vacancy lifecycle

import { supabase } from "@/lib/supabase";
import { publish } from "@/lib/platform/events";
import { logger } from "@/lib/platform/events/logger.service";
import { Vacancy, VacancyStatus, VacancyEvents } from './vacancy.types';

// ============================================================
// STANDARD SERVICE RESULT
// ============================================================

export interface OrchestratorResult<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================
// VACANCY ORCHESTRATOR
// ============================================================

export class VacancyOrchestrator {
  private supabase = supabase;

  // ============================================================
  // CREATE FROM LEASE EVENT — Primary creation path
  // ============================================================

  async createFromLeaseEnd(params: {
    lease_id: string;
    property_id: string;
    unit_id: string;
    vacancy_date: string;
    reason: 'lease_expired' | 'tenant_terminated' | 'eviction';
  }): Promise<OrchestratorResult<Vacancy>> {
    try {
      const { data, error } = await this.supabase
        .from('vacancies')
        .insert({
          property_id: params.property_id,
          unit_id: params.unit_id,
          lease_id: params.lease_id,
          vacancy_date: params.vacancy_date,
          reason: params.reason,
          status: 'active',
          marketing_status: 'not_started',
        })
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'VACANCY_CREATE_FAILED', message: error?.message || 'Failed to create vacancy' },
        };
      }

      // Publish event
      await publish(VacancyEvents.Created, {
        correlationId: data.id,
        source: 'vacancy-orchestrator',
        version: '1.0',
        entity: { id: data.id, type: 'vacancy' },
        payload: {
          vacancyId: data.id,
          propertyId: params.property_id,
          unitId: params.unit_id,
          leaseId: params.lease_id,
          reason: params.reason,
        },
      });

      logger.info('Vacancy created from lease end', {
        vacancyId: data.id,
        leaseId: params.lease_id,
        reason: params.reason,
      });

      return { data: data as Vacancy };
    } catch (error) {
      return {
        error: {
          code: 'VACANCY_CREATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ============================================================
  // CREATE MANUAL — For exceptional cases
  // ============================================================

  async createManual(params: {
    property_id: string;
    unit_id: string;
    vacancy_date: string;
    expected_release_date?: string;
    reason: 'renovation' | 'new_build' | 'other';
  }): Promise<OrchestratorResult<Vacancy>> {
    try {
      const { data, error } = await this.supabase
        .from('vacancies')
        .insert({
          property_id: params.property_id,
          unit_id: params.unit_id,
          vacancy_date: params.vacancy_date,
          expected_release_date: params.expected_release_date,
          reason: params.reason,
          status: 'active',
          marketing_status: 'not_started',
        })
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'VACANCY_CREATE_FAILED', message: error?.message || 'Failed to create vacancy' },
        };
      }

      await publish(VacancyEvents.Created, {
        correlationId: data.id,
        source: 'vacancy-orchestrator',
        version: '1.0',
        entity: { id: data.id, type: 'vacancy' },
        payload: {
          vacancyId: data.id,
          propertyId: params.property_id,
          unitId: params.unit_id,
          reason: params.reason,
          manual: true,
        },
      });

      return { data: data as Vacancy };
    } catch (error) {
      return {
        error: {
          code: 'VACANCY_CREATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ============================================================
  // ASSIGN BROKER
  // ============================================================

  async assignBroker(vacancyId: string, brokerId: string, mandateId: string): Promise<OrchestratorResult<Vacancy>> {
    try {
      const { data, error } = await this.supabase
        .from('vacancies')
        .update({
          current_broker_id: brokerId,
          current_mandate_id: mandateId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', vacancyId)
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'VACANCY_ASSIGN_BROKER_FAILED', message: error?.message || 'Failed to assign broker' },
        };
      }

      await publish(VacancyEvents.BrokerAssigned, {
        correlationId: vacancyId,
        source: 'vacancy-orchestrator',
        version: '1.0',
        entity: { id: vacancyId, type: 'vacancy' },
        payload: { vacancyId, brokerId, mandateId },
      });

      return { data: data as Vacancy };
    } catch (error) {
      return {
        error: {
          code: 'VACANCY_ASSIGN_BROKER_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ============================================================
  // START MARKETING
  // ============================================================

  async startMarketing(vacancyId: string, listingUrl?: string, brochureUrl?: string): Promise<OrchestratorResult<Vacancy>> {
    try {
      const { data, error } = await this.supabase
        .from('vacancies')
        .update({
          marketing_status: 'active',
          listing_url: listingUrl,
          brochure_url: brochureUrl,
          status: 'marketing',
          updated_at: new Date().toISOString(),
        })
        .eq('id', vacancyId)
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'VACANCY_START_MARKETING_FAILED', message: error?.message || 'Failed to start marketing' },
        };
      }

      await publish(VacancyEvents.MarketingStarted, {
        correlationId: vacancyId,
        source: 'vacancy-orchestrator',
        version: '1.0',
        entity: { id: vacancyId, type: 'vacancy' },
        payload: { vacancyId, listingUrl, brochureUrl },
      });

      return { data: data as Vacancy };
    } catch (error) {
      return {
        error: {
          code: 'VACANCY_START_MARKETING_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ============================================================
  // RECORD ENQUIRY
  // ============================================================

  async recordEnquiry(vacancyId: string, params: {
    applicant_name: string;
    applicant_company?: string;
    contact_email?: string;
    contact_phone?: string;
    source?: string;
    broker_id?: string;
  }): Promise<OrchestratorResult<any>> {
    try {
      const { data, error } = await this.supabase
        .from('enquiries')
        .insert({
          vacancy_id: vacancyId,
          broker_id: params.broker_id,
          applicant_name: params.applicant_name,
          applicant_company: params.applicant_company,
          contact_email: params.contact_email,
          contact_phone: params.contact_phone,
          source: params.source,
          status: 'new',
        })
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'ENQUIRY_RECORD_FAILED', message: error?.message || 'Failed to record enquiry' },
        };
      }

      await publish(VacancyEvents.EnquiryReceived, {
        correlationId: vacancyId,
        source: 'vacancy-orchestrator',
        version: '1.0',
        entity: { id: vacancyId, type: 'vacancy' },
        payload: { vacancyId, enquiryId: data.id, applicant: params.applicant_name },
      });

      return { data };
    } catch (error) {
      return {
        error: {
          code: 'ENQUIRY_RECORD_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ============================================================
  // SCHEDULE VIEWING
  // ============================================================

  async scheduleViewing(vacancyId: string, params: {
    enquiry_id: string;
    viewing_date: string;
    duration_minutes?: number;
    attendee_names?: string[];
    broker_id?: string;
  }): Promise<OrchestratorResult<any>> {
    try {
      const { data, error } = await this.supabase
        .from('viewings')
        .insert({
          vacancy_id: vacancyId,
          enquiry_id: params.enquiry_id,
          broker_id: params.broker_id,
          viewing_date: params.viewing_date,
          duration_minutes: params.duration_minutes || 30,
          status: 'scheduled',
          attendee_names: params.attendee_names || [],
          attendee_count: (params.attendee_names || []).length,
        })
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'VIEWING_SCHEDULE_FAILED', message: error?.message || 'Failed to schedule viewing' },
        };
      }

      await publish(VacancyEvents.ViewingScheduled, {
        correlationId: vacancyId,
        source: 'vacancy-orchestrator',
        version: '1.0',
        entity: { id: vacancyId, type: 'vacancy' },
        payload: { vacancyId, viewingId: data.id, viewingDate: params.viewing_date },
      });

      return { data };
    } catch (error) {
      return {
        error: {
          code: 'VIEWING_SCHEDULE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ============================================================
  // RECORD OFFER
  // ============================================================

  async recordOffer(vacancyId: string, params: {
    enquiry_id?: string;
    broker_id?: string;
    offer_date: string;
    proposed_rental: number;
    proposed_deposit?: number;
    proposed_term?: number;
    proposed_commencement?: string;
    special_conditions?: string;
  }): Promise<OrchestratorResult<any>> {
    try {
      const { data, error } = await this.supabase
        .from('offers')
        .insert({
          vacancy_id: vacancyId,
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
          error: { code: 'OFFER_RECORD_FAILED', message: error?.message || 'Failed to record offer' },
        };
      }

      await publish(VacancyEvents.OfferReceived, {
        correlationId: vacancyId,
        source: 'vacancy-orchestrator',
        version: '1.0',
        entity: { id: vacancyId, type: 'vacancy' },
        payload: { vacancyId, offerId: data.id, proposedRental: params.proposed_rental },
      });

      return { data };
    } catch (error) {
      return {
        error: {
          code: 'OFFER_RECORD_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ============================================================
  // CONVERT TO LEASE — Called by Execution Engine event
  // ============================================================

  async convertToLease(vacancyId: string, leaseId: string): Promise<OrchestratorResult<Vacancy>> {
    try {
      const { data, error } = await this.supabase
        .from('vacancies')
        .update({
          status: 'converted',
          converted_to_lease_id: leaseId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', vacancyId)
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'VACANCY_CONVERT_FAILED', message: error?.message || 'Failed to convert vacancy' },
        };
      }

      await publish(VacancyEvents.Converted, {
        correlationId: vacancyId,
        source: 'vacancy-orchestrator',
        version: '1.0',
        entity: { id: vacancyId, type: 'vacancy' },
        payload: { vacancyId, leaseId },
      });

      return { data: data as Vacancy };
    } catch (error) {
      return {
        error: {
          code: 'VACANCY_CONVERT_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ============================================================
  // CLOSE VACANCY
  // ============================================================

  async close(vacancyId: string, reason: 'converted' | 'cancelled' | 'withdrawn'): Promise<OrchestratorResult<Vacancy>> {
    try {
      const { data, error } = await this.supabase
        .from('vacancies')
        .update({
          status: reason === 'cancelled' ? 'cancelled' : 'closed',
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', vacancyId)
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'VACANCY_CLOSE_FAILED', message: error?.message || 'Failed to close vacancy' },
        };
      }

      await publish(VacancyEvents.Closed, {
        correlationId: vacancyId,
        source: 'vacancy-orchestrator',
        version: '1.0',
        entity: { id: vacancyId, type: 'vacancy' },
        payload: { vacancyId, reason },
      });

      return { data: data as Vacancy };
    } catch (error) {
      return {
        error: {
          code: 'VACANCY_CLOSE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}

export const vacancyOrchestrator = new VacancyOrchestrator();
