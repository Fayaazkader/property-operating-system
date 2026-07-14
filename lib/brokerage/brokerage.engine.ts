// lib/brokerage/brokerage.engine.ts
// Brokerage Engine — Orchestrates all brokerage operations

import { supabase } from "@/lib/supabase";
import { publish } from "@/lib/platform/events";
import { logger } from "@/lib/platform/events/logger.service";
import { OperationResult, BrokerStatus, MandateStatus } from "@/lib/platform/types";
import { brokerService } from './brokers/broker.service';
import { mandateService } from './mandates/mandate.service';
import { CreateBrokerParams, UpdateBrokerParams } from './brokers/broker.types';
import { CreateMandateParams, UpdateMandateParams } from './mandates/mandate.types';

export class BrokerageEngine {
  private supabase = supabase;

  // ============================================================
  // BROKER OPERATIONS
  // ============================================================

  async createBroker(
    params: CreateBrokerParams,
    entityId: string,
    correlationId: string = crypto.randomUUID()
  ): Promise<OperationResult<any>> {
    try {
      // 1. Validate
      if (!params.name) {
        return {
          success: false,
          error: { code: 'VALIDATION_FAILED', message: 'Broker name is required' },
          correlationId,
        };
      }

      // 2. Check for duplicate
      const existing = await this.supabase
        .from('brokers')
        .select('id, name')
        .eq('name', params.name)
        .eq('entity_id', entityId)
        .maybeSingle();

      if (existing?.data) {
        return {
          success: false,
          error: { code: 'DUPLICATE_BROKER', message: `Broker "${params.name}" already exists` },
          correlationId,
        };
      }

      // 3. Persist
      const result = await brokerService.create(params, entityId);

      if (result.error) {
        return {
          success: false,
          error: { code: result.error.code, message: result.error.message },
          correlationId,
        };
      }

      // 4. Publish event (engine owns this)
      await publish('broker.created', {
        correlationId,
        source: 'brokerage-engine',
        version: '1.0',
        entity: { id: result.data!.id, type: 'broker' },
        payload: {
          brokerId: result.data!.id,
          name: result.data!.name,
          entityId,
        },
      });

      logger.info('Broker created via engine', { brokerId: result.data!.id, correlationId });

      return {
        success: true,
        data: result.data,
        correlationId,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'BROKER_CREATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        correlationId,
      };
    }
  }

  async updateBroker(
    id: string,
    params: UpdateBrokerParams,
    correlationId: string = crypto.randomUUID()
  ): Promise<OperationResult<any>> {
    try {
      // 1. Get current state (for optimistic concurrency)
      const current = await brokerService.get(id);
      if (current.error || !current.data) {
        return {
          success: false,
          error: { code: 'BROKER_NOT_FOUND', message: 'Broker not found' },
          correlationId,
        };
      }

      // 2. Validate if changing status
      if (params.status && params.status === 'inactive') {
        // Check if broker has active mandates
        const { data: mandates } = await this.supabase
          .from('broker_mandates')
          .select('id, status')
          .eq('broker_id', id)
          .in('status', ['pending', 'accepted']);

        if (mandates && mandates.length > 0) {
          return {
            success: false,
            error: {
              code: 'BROKER_HAS_ACTIVE_MANDATES',
              message: `Cannot archive broker: ${mandates.length} active mandate(s) exist`,
            },
            correlationId,
          };
        }
      }

      // 3. Persist
      const result = await brokerService.update(id, params);

      if (result.error) {
        return {
          success: false,
          error: { code: result.error.code, message: result.error.message },
          correlationId,
        };
      }

      // 4. Publish event
      await publish('broker.updated', {
        correlationId,
        source: 'brokerage-engine',
        version: '1.0',
        entity: { id: result.data!.id, type: 'broker' },
        payload: {
          brokerId: result.data!.id,
          updatedFields: Object.keys(params),
        },
      });

      return {
        success: true,
        data: result.data,
        correlationId,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'BROKER_UPDATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        correlationId,
      };
    }
  }

  // ============================================================
  // MANDATE OPERATIONS
  // ============================================================

  async createMandate(
    params: CreateMandateParams,
    entityId: string,
    correlationId: string = crypto.randomUUID()
  ): Promise<OperationResult<any>> {
    try {
      // 1. Validate
      if (params.commission_rate <= 0 || params.commission_rate > 100) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Commission rate must be between 0 and 100',
          },
          correlationId,
        };
      }

      // 2. Check if vacancy already has active mandate
      const existing = await this.supabase
        .from('broker_mandates')
        .select('id, status')
        .eq('vacancy_id', params.vacancy_id)
        .in('status', ['pending', 'accepted']);

      if (existing.data && existing.data.length > 0) {
        return {
          success: false,
          error: {
            code: 'VACANCY_HAS_ACTIVE_MANDATE',
            message: 'This vacancy already has an active mandate',
          },
          correlationId,
        };
      }

      // 3. Persist
      const result = await mandateService.create(params, entityId);

      if (result.error) {
        return {
          success: false,
          error: { code: result.error.code, message: result.error.message },
          correlationId,
        };
      }

      // 4. Publish event
      await publish('broker.mandate.created', {
        correlationId,
        source: 'brokerage-engine',
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
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'MANDATE_CREATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        correlationId,
      };
    }
  }

  async acceptMandate(
    id: string,
    correlationId: string = crypto.randomUUID()
  ): Promise<OperationResult<any>> {
    try {
      const current = await mandateService.get(id);
      if (current.error || !current.data) {
        return {
          success: false,
          error: { code: 'MANDATE_NOT_FOUND', message: 'Mandate not found' },
          correlationId,
        };
      }

      if (current.data.status !== 'pending') {
        return {
          success: false,
          error: {
            code: 'MANDATE_NOT_PENDING',
            message: `Cannot accept mandate in "${current.data.status}" state`,
          },
          correlationId,
        };
      }

      const result = await mandateService.accept(id);

      if (result.error) {
        return {
          success: false,
          error: { code: result.error.code, message: result.error.message },
          correlationId,
        };
      }

      // Update vacancy with broker
      await this.supabase
        .from('vacancies')
        .update({
          current_broker_id: result.data!.broker_id,
          current_mandate_id: result.data!.id,
        })
        .eq('id', result.data!.vacancy_id);

      await publish('broker.mandate.accepted', {
        correlationId,
        source: 'brokerage-engine',
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
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'MANDATE_ACCEPT_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        correlationId,
      };
    }
  }
}

export const brokerageEngine = new BrokerageEngine();
