// lib/brokerage/lifecycles/broker.lifecycle.ts
// Broker Lifecycle — Owns broker operations

import { publish } from "@/lib/platform/events";
import { logger } from "@/lib/platform/events/logger.service";
import { OperationResult } from "@/lib/platform/types";
import { brokerService } from '../brokers/broker.service';
import { companyService } from '../companies/company.service';
import { CreateBrokerParams, CreateCompanyParams } from '../index';

export class BrokerLifecycle {
  async createCompany(
    params: CreateCompanyParams,
    entityId: string,
    correlationId: string = crypto.randomUUID()
  ): Promise<OperationResult<any>> {
    const result = await companyService.create(params, entityId);
    if (result.error) {
      return {
        success: false,
        error: result.error,
        correlationId,
      };
    }

    await publish('broker.company.created', {
      correlationId,
      source: 'broker-lifecycle',
      version: '1.0',
      entity: { id: result.data!.id, type: 'broker_company' },
      payload: {
        companyId: result.data!.id,
        name: result.data!.name,
        entityId,
      },
    });

    return {
      success: true,
      data: result.data,
      correlationId,
    };
  }

  async createBroker(
    params: CreateBrokerParams,
    entityId: string,
    correlationId: string = crypto.randomUUID()
  ): Promise<OperationResult<any>> {
    const result = await brokerService.create(params, entityId);
    if (result.error) {
      return {
        success: false,
        error: result.error,
        correlationId,
      };
    }

    await publish('broker.created', {
      correlationId,
      source: 'broker-lifecycle',
      version: '1.0',
      entity: { id: result.data!.id, type: 'broker' },
      payload: {
        brokerId: result.data!.id,
        name: result.data!.name,
        entityId,
      },
    });

    return {
      success: true,
      data: result.data,
      correlationId,
    };
  }

  async archiveBroker(
    brokerId: string,
    correlationId: string = crypto.randomUUID()
  ): Promise<OperationResult<any>> {
    const result = await brokerService.archive(brokerId);
    if (result.error) {
      return {
        success: false,
        error: result.error,
        correlationId,
      };
    }

    await publish('broker.archived', {
      correlationId,
      source: 'broker-lifecycle',
      version: '1.0',
      entity: { id: brokerId, type: 'broker' },
      payload: { brokerId },
    });

    return {
      success: true,
      data: result.data,
      correlationId,
    };
  }
}

export const brokerLifecycle = new BrokerLifecycle();
