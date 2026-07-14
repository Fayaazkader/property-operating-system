// lib/brokerage/negotiations/negotiation.service.ts
// Negotiation Service — Pure Persistence (No Business Logic)

import { supabase } from "@/lib/supabase";
import { ServiceResult } from "@/lib/platform/types";
import { 
  CreateNegotiationParams, 
  AddNegotiationRoundParams, 
  Negotiation, 
  NegotiationRound 
} from './negotiation.types';

export class NegotiationService {
  private supabase = supabase;

  async create(params: CreateNegotiationParams, entityId: string): Promise<ServiceResult<Negotiation>> {
    try {
      const initialRound: NegotiationRound = {
        id: crypto.randomUUID(),
        negotiation_id: '', // Will be set after negotiation creation
        round_number: 1,
        type: 'initial_offer',
        proposed_rental: params.initial_round.proposed_rental,
        proposed_deposit: params.initial_round.proposed_deposit,
        proposed_term: params.initial_round.proposed_term,
        proposed_commencement: params.initial_round.proposed_commencement,
        special_conditions: params.initial_round.special_conditions,
        notes: params.initial_round.notes,
        proposed_by: params.initial_round.proposed_by,
        proposed_by_id: params.initial_round.proposed_by_id,
        status: 'sent',
        created_at: new Date().toISOString(),
      };

      const { data, error } = await this.supabase
        .from('negotiations')
        .insert({
          entity_id: entityId,
          offer_id: params.offer_id,
          vacancy_id: params.vacancy_id,
          status: 'active',
          rounds: [initialRound],
          current_round: 1,
        })
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'NEGOTIATION_CREATE_FAILED', message: error?.message || 'Failed to create negotiation' },
        };
      }

      // Update the round with the correct negotiation_id
      const rounds = data.rounds || [];
      if (rounds.length > 0) {
        rounds[0].negotiation_id = data.id;
        await this.supabase
          .from('negotiations')
          .update({ rounds })
          .eq('id', data.id);
      }

      return { data: data as Negotiation };
    } catch (error) {
      return {
        error: {
          code: 'NEGOTIATION_CREATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async get(id: string): Promise<ServiceResult<Negotiation>> {
    try {
      const { data, error } = await this.supabase
        .from('negotiations')
        .select(`
          *,
          offer:offers(id, proposed_rental, status),
          vacancy:vacancies(id, status, property_id)
        `)
        .eq('id', id)
        .single();

      if (error || !data) {
        return {
          error: { code: 'NEGOTIATION_NOT_FOUND', message: error?.message || 'Negotiation not found' },
        };
      }

      return { data: data as Negotiation };
    } catch (error) {
      return {
        error: {
          code: 'NEGOTIATION_GET_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async getByOffer(offerId: string): Promise<ServiceResult<Negotiation>> {
    try {
      const { data, error } = await this.supabase
        .from('negotiations')
        .select('*')
        .eq('offer_id', offerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return {
          error: { code: 'NEGOTIATION_NOT_FOUND', message: 'Negotiation not found for this offer' },
        };
      }

      return { data: data as Negotiation };
    } catch (error) {
      return {
        error: {
          code: 'NEGOTIATION_GET_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async addRound(negotiationId: string, params: AddNegotiationRoundParams): Promise<ServiceResult<Negotiation>> {
    try {
      const { data: negotiation, error: getError } = await this.supabase
        .from('negotiations')
        .select('rounds, current_round')
        .eq('id', negotiationId)
        .single();

      if (getError || !negotiation) {
        return {
          error: { code: 'NEGOTIATION_NOT_FOUND', message: 'Negotiation not found' },
        };
      }

      const currentRounds = negotiation.rounds || [];
      const nextRoundNumber = currentRounds.length + 1;

      const newRound: NegotiationRound = {
        id: crypto.randomUUID(),
        negotiation_id: negotiationId,
        round_number: nextRoundNumber,
        type: 'counter_proposal',
        proposed_rental: params.proposed_rental,
        proposed_deposit: params.proposed_deposit,
        proposed_term: params.proposed_term,
        proposed_commencement: params.proposed_commencement,
        special_conditions: params.special_conditions,
        notes: params.notes,
        proposed_by: params.proposed_by,
        proposed_by_id: params.proposed_by_id,
        status: 'sent',
        created_at: new Date().toISOString(),
      };

      const updatedRounds = [...currentRounds, newRound];

      const { data, error } = await this.supabase
        .from('negotiations')
        .update({
          rounds: updatedRounds,
          current_round: nextRoundNumber,
        })
        .eq('id', negotiationId)
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'NEGOTIATION_ADD_ROUND_FAILED', message: error?.message || 'Failed to add round' },
        };
      }

      return { data: data as Negotiation };
    } catch (error) {
      return {
        error: {
          code: 'NEGOTIATION_ADD_ROUND_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async updateRoundStatus(
    negotiationId: string, 
    roundId: string, 
    status: 'sent' | 'viewed' | 'responded' | 'accepted' | 'declined'
  ): Promise<ServiceResult<Negotiation>> {
    try {
      const { data: negotiation, error: getError } = await this.supabase
        .from('negotiations')
        .select('rounds')
        .eq('id', negotiationId)
        .single();

      if (getError || !negotiation) {
        return {
          error: { code: 'NEGOTIATION_NOT_FOUND', message: 'Negotiation not found' },
        };
      }

      const rounds = negotiation.rounds || [];
      const updatedRounds = rounds.map((r: NegotiationRound) => {
        if (r.id === roundId) {
          return { ...r, status };
        }
        return r;
      });

      const { data, error } = await this.supabase
        .from('negotiations')
        .update({ rounds: updatedRounds })
        .eq('id', negotiationId)
        .select()
        .single();

      if (error || !data) {
        return {
          error: { code: 'NEGOTIATION_UPDATE_ROUND_FAILED', message: error?.message || 'Failed to update round' },
        };
      }

      return { data: data as Negotiation };
    } catch (error) {
      return {
        error: {
          code: 'NEGOTIATION_UPDATE_ROUND_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}

export const negotiationService = new NegotiationService();
