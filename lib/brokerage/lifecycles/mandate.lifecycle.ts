// lib/brokerage/lifecycles/mandate.lifecycle.ts
// Mandate Lifecycle — Owns mandate operations

import { supabase } from "@/lib/supabase";
import { publish } from "@/lib/platform/events";
import { logger } from "@/lib/platform/events/logger.service";
import { OperationResult } from "@/lib/platform/types";
import { mandateService } from '../mandates/mandate.service';
import { CreateMandateParams } from '../index';

export class MandateLifecycle {
  private supabase = supabase;

  async createMandate(
    params: CreateMandateParams,
    entityId: string,
    correlationId: string = crypto.randomUUID()
  ): Promise<OperationResult<any>> {
    const { data: vacancy } = await this.supabase
      .from('vacancies')
      .select('status')
      .eq('id', params.vacancy_id)
      .single();

    if (!vacancy || vacancy.status === 'closed' || vacancy.status === 'cancelled') {
      return {
        success: false,
        error: {
          code: 'VACANCY_NOT_AVAILABLE',
          message: 'Vacancy is not available for mandate',
        },
        correlationId,
      };
    }

    const result = await mandateService.create(params, entityId);
    if (result.error) {
      return {
        success: false,
        error: { code: result.error.code, message: result.error.message },
        correlationId,
      };
    }

    await publish('broker.mandate.created', {
      correlationId,
      source: 'mandate-lifecycle',
      version: '1.0',
      entity: { id: result.data!.id, type: 'mandate' },
      payload: {
        mandateId: result.data!.id,
        brokerId: params.broker_id,
        vacancyId: params.vacancy_id,
      },
    });

    return {
      success: true,
      data: result.data,
      correlationId,
    };
  }

  async acceptMandate(
    mandateId: string,
    correlationId: string = crypto.randomUUID()
  ): Promise<OperationResult<any>> {
    const result = await mandateService.accept(mandateId);
    if (result.error) {
      return {
        success: false,
        error: { code: result.error.code, message: result.error.message },
        correlationId,
      };
    }

    await this.supabase
      .from('vacancies')
      .update({
        current_broker_id: result.data!.broker_id,
        current_mandate_id: result.data!.id,
        status: 'marketing',
        marketing_status: 'in_progress',
      })
      .eq('id', result.data!.vacancy_id);

    await publish('broker.mandate.accepted', {
      correlationId,
      source: 'mandate-lifecycle',
      version: '1.0',
      entity: { id: result.data!.id, type: 'mandate' },
      payload: {
        mandateId: result.data!.id,
        brokerId: result.data!.broker_id,
        vacancyId: result.data!.vacancy_id,
      },
    });

    return {
      success: true,
      data: result.data,
      correlationId,
    };
  }

  async declineMandate(
    mandateId: string,
    reason?: string,
    correlationId: string = crypto.randomUUID()
  ): Promise<OperationResult<any>> {
    const result = await mandateService.decline(mandateId);
    if (result.error) {
      return {
        success: false,
        error: { code: result.error.code, message: result.error.message },
        correlationId,
      };
    }

    await publish('broker.mandate.declined', {
      correlationId,
      source: 'mandate-lifecycle',
      version: '1.0',
      entity: { id: result.data!.id, type: 'mandate' },
      payload: {
        mandateId: result.data!.id,
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

export const mandateLifecycle = new MandateLifecycle();
