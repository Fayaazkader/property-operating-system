// lib/brokerage/brokerage.orchestrator.ts
// Brokerage Orchestrator — Composes all lifecycles

import { OperationResult } from "@/lib/platform/types";
import { brokerLifecycle } from './lifecycles/broker.lifecycle';
import { mandateLifecycle } from './lifecycles/mandate.lifecycle';
import { offerLifecycle } from './lifecycles/offer.lifecycle';
import { commissionLifecycle } from './lifecycles/commission.lifecycle';
import { vacancyOrchestrator } from './engine/vacancy.orchestrator';
import { enquiryService } from './enquiries/enquiry.service';
import { viewingService } from './viewings/viewing.service';
import { negotiationService } from './negotiations/negotiation.service';
import {
  CreateCompanyParams,
  CreateBrokerParams,
  CreateMandateParams,
  CreateEnquiryParams,
  CreateViewingParams,
  CreateOfferParams,
  AddNegotiationRoundParams,
} from './index';

export class BrokerageOrchestrator {
  // ============================================================
  // BROKER LIFECYCLE
  // ============================================================

  async createCompany(params: CreateCompanyParams, entityId: string, correlationId?: string): Promise<OperationResult<any>> {
    return brokerLifecycle.createCompany(params, entityId, correlationId);
  }

  async createBroker(params: CreateBrokerParams, entityId: string, correlationId?: string): Promise<OperationResult<any>> {
    return brokerLifecycle.createBroker(params, entityId, correlationId);
  }

  async archiveBroker(brokerId: string, correlationId?: string): Promise<OperationResult<any>> {
    return brokerLifecycle.archiveBroker(brokerId, correlationId);
  }

  // ============================================================
  // MANDATE LIFECYCLE
  // ============================================================

  async createMandate(params: CreateMandateParams, entityId: string, correlationId?: string): Promise<OperationResult<any>> {
    return mandateLifecycle.createMandate(params, entityId, correlationId);
  }

  async acceptMandate(mandateId: string, correlationId?: string): Promise<OperationResult<any>> {
    return mandateLifecycle.acceptMandate(mandateId, correlationId);
  }

  async declineMandate(mandateId: string, reason?: string, correlationId?: string): Promise<OperationResult<any>> {
    return mandateLifecycle.declineMandate(mandateId, reason, correlationId);
  }

  // ============================================================
  // OFFER LIFECYCLE
  // ============================================================

  async createOfferWithNegotiation(params: CreateOfferParams, entityId: string, correlationId?: string): Promise<OperationResult<any>> {
    return offerLifecycle.createOfferWithNegotiation(params, entityId, correlationId);
  }

  async acceptOffer(offerId: string, finalRental: number, finalTerms?: string, correlationId?: string): Promise<OperationResult<any>> {
    return offerLifecycle.acceptOffer(offerId, finalRental, finalTerms, correlationId);
  }

  async declineOffer(offerId: string, reason?: string, correlationId?: string): Promise<OperationResult<any>> {
    return offerLifecycle.declineOffer(offerId, reason, correlationId);
  }

  // ============================================================
  // COMMISSION LIFECYCLE
  // ============================================================

  async calculateAndCreateCommission(
    params: {
      broker_id: string;
      lease_id: string;
      mandate_id?: string;
      vacancy_id?: string;
      commission_type: 'percentage' | 'fixed' | 'tiered';
      commission_rate: number;
      annual_rent: number;
      lease_term_months: number;
      split_percentage?: number;
      notes?: string;
    },
    entityId: string,
    correlationId?: string
  ): Promise<OperationResult<any>> {
    return commissionLifecycle.calculateAndCreateCommission(params, entityId, correlationId);
  }

  async approveCommission(commissionId: string, approvedBy: string, correlationId?: string): Promise<OperationResult<any>> {
    return commissionLifecycle.approveCommission(commissionId, approvedBy, correlationId);
  }

  async requestCommissionPayment(commissionId: string, paymentRequestId: string, correlationId?: string): Promise<OperationResult<any>> {
    return commissionLifecycle.requestCommissionPayment(commissionId, paymentRequestId, correlationId);
  }

  async declineCommission(commissionId: string, reason?: string, correlationId?: string): Promise<OperationResult<any>> {
    return commissionLifecycle.declineCommission(commissionId, reason, correlationId);
  }

  // ============================================================
  // VACANCY LIFECYCLE
  // ============================================================

  async createVacancyFromLeaseEnd(
    params: {
      lease_id: string;
      property_id: string;
      unit_id: string;
      vacancy_date: string;
      reason: 'lease_expired' | 'tenant_terminated' | 'eviction';
    },
    correlationId: string = crypto.randomUUID()
  ): Promise<OperationResult<any>> {
    const result = await vacancyOrchestrator.createFromLeaseEnd(params);
    
    // Convert OrchestratorResult to OperationResult
    if (result.error) {
      return {
        success: false,
        error: {
          code: result.error.code || 'VACANCY_CREATE_FAILED',
          message: result.error.message,
        },
        correlationId,
      };
    }

    return {
      success: true,
      data: result.data,
      correlationId,
    };
  }

  // ============================================================
  // ENQUIRY LIFECYCLE
  // ============================================================

  async createEnquiry(params: CreateEnquiryParams, entityId: string, correlationId?: string): Promise<OperationResult<any>> {
    const result = await enquiryService.create(params, entityId);
    const cid = correlationId || crypto.randomUUID();
    if (result.error) {
      return { success: false, error: { code: result.error.code, message: result.error.message }, correlationId: cid };
    }
    return { success: true, data: result.data, correlationId: cid };
  }

  // ============================================================
  // VIEWING LIFECYCLE
  // ============================================================

  async scheduleViewing(params: CreateViewingParams, entityId: string, correlationId?: string): Promise<OperationResult<any>> {
    const result = await viewingService.create(params, entityId);
    const cid = correlationId || crypto.randomUUID();
    if (result.error) {
      return { success: false, error: { code: result.error.code, message: result.error.message }, correlationId: cid };
    }
    return { success: true, data: result.data, correlationId: cid };
  }

  async completeViewing(viewingId: string, outcome: string, feedback?: string, correlationId?: string): Promise<OperationResult<any>> {
    const result = await viewingService.complete(viewingId, outcome, feedback);
    const cid = correlationId || crypto.randomUUID();
    if (result.error) {
      return { success: false, error: { code: result.error.code, message: result.error.message }, correlationId: cid };
    }
    return { success: true, data: result.data, correlationId: cid };
  }

  // ============================================================
  // NEGOTIATION LIFECYCLE
  // ============================================================

  async addNegotiationRound(params: AddNegotiationRoundParams, correlationId?: string): Promise<OperationResult<any>> {
    const result = await negotiationService.addRound(params.negotiation_id, params);
    const cid = correlationId || crypto.randomUUID();
    if (result.error) {
      return { success: false, error: { code: result.error.code, message: result.error.message }, correlationId: cid };
    }
    return { success: true, data: result.data, correlationId: cid };
  }

  async acceptNegotiation(
    negotiationId: string,
    roundId: string,
    finalRental?: number,
    finalTerms?: string,
    correlationId?: string
  ): Promise<OperationResult<any>> {
    const result = await negotiationService.acceptCounterOffer(negotiationId, roundId);
    const cid = correlationId || crypto.randomUUID();
    if (result.error) {
      return { success: false, error: { code: result.error.code, message: result.error.message }, correlationId: cid };
    }
    return { success: true, data: result.data, correlationId: cid };
  }
}

export const brokerageOrchestrator = new BrokerageOrchestrator();
