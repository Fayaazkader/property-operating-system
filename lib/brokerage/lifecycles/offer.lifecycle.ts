// lib/brokerage/lifecycles/offer.lifecycle.ts
// Offer Lifecycle — Owns offer operations

import { publish } from "@/lib/platform/events";
import { logger } from "@/lib/platform/events/logger.service";
import { OperationResult } from "@/lib/platform/types";
import { offerService } from '../offers/offer.service';
import { negotiationService } from '../negotiations/negotiation.service';
import { CreateOfferParams, CreateNegotiationParams } from '../index';

export class OfferLifecycle {
  async createOfferWithNegotiation(
    params: CreateOfferParams,
    entityId: string,
    correlationId: string = crypto.randomUUID()
  ): Promise<OperationResult<any>> {
    // Step 1: Create the offer
    const offerResult = await offerService.create(params, entityId);
    if (offerResult.error) {
      return {
        success: false,
        error: offerResult.error,
        correlationId,
      };
    }

    // Step 2: Create the negotiation
    const negotiationParams: CreateNegotiationParams = {
      offer_id: offerResult.data!.id,
      vacancy_id: params.vacancy_id,
      initial_round: {
        proposed_rental: params.proposed_rental,
        proposed_deposit: params.proposed_deposit,
        proposed_term: params.proposed_term,
        proposed_commencement: params.proposed_commencement,
        special_conditions: params.special_conditions,
        proposed_by: 'tenant',
      },
    };

    const negotiationResult = await negotiationService.create(negotiationParams, entityId);
    if (negotiationResult.error) {
      return {
        success: false,
        error: negotiationResult.error,
        correlationId,
      };
    }

    await publish('broker.offer.received', {
      correlationId,
      source: 'offer-lifecycle',
      version: '1.0',
      entity: { id: offerResult.data!.id, type: 'offer' },
      payload: {
        offerId: offerResult.data!.id,
        vacancyId: params.vacancy_id,
        proposedRental: params.proposed_rental,
        brokerId: params.broker_id,
      },
    });

    return {
      success: true,
      data: {
        offer: offerResult.data,
        negotiation: negotiationResult.data,
      },
      correlationId,
    };
  }

  async acceptOffer(
    offerId: string,
    finalRental: number,
    finalTerms?: string,
    correlationId: string = crypto.randomUUID()
  ): Promise<OperationResult<any>> {
    const result = await offerService.accept(offerId, finalRental, finalTerms);
    if (result.error) {
      return {
        success: false,
        error: result.error,
        correlationId,
      };
    }

    await publish('broker.offer.accepted', {
      correlationId,
      source: 'offer-lifecycle',
      version: '1.0',
      entity: { id: result.data!.id, type: 'offer' },
      payload: {
        offerId: result.data!.id,
        vacancyId: result.data!.vacancy_id,
        finalRental,
        finalTerms,
      },
    });

    return {
      success: true,
      data: result.data,
      correlationId,
    };
  }

  async declineOffer(
    offerId: string,
    reason?: string,
    correlationId: string = crypto.randomUUID()
  ): Promise<OperationResult<any>> {
    const result = await offerService.decline(offerId, reason);
    if (result.error) {
      return {
        success: false,
        error: result.error,
        correlationId,
      };
    }

    await publish('broker.offer.declined', {
      correlationId,
      source: 'offer-lifecycle',
      version: '1.0',
      entity: { id: result.data!.id, type: 'offer' },
      payload: {
        offerId: result.data!.id,
        vacancyId: result.data!.vacancy_id,
        reason: reason || 'No reason provided',
      },
    });

    return {
      success: true,
      data: result.data,
      correlationId,
    };
  }
}

export const offerLifecycle = new OfferLifecycle();
