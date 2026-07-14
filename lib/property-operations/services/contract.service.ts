// lib/property-operations/services/contract.service.ts
// Contract Service — Business Logic Layer

import { ServiceResult } from "@/lib/platform/types";
import { contractRepository } from '../repositories/contract.repository';
import { CreateContractParams, ServiceContract, ContractFrequency } from '../types';

export class ContractService {
  private repository = contractRepository;

  async create(params: CreateContractParams, entityId: string): Promise<ServiceResult<ServiceContract>> {
    let nextServiceDate: string | undefined = undefined;
    const daysMap: Record<ContractFrequency, number> = {
      daily: 1,
      weekly: 7,
      monthly: 30,
      quarterly: 90,
      bi_annual: 180,
      annual: 365,
    };

    const days = params.frequency_days || daysMap[params.frequency] || 30;
    if (params.start_date) {
      const date = new Date(params.start_date);
      date.setDate(date.getDate() + days);
      nextServiceDate = date.toISOString().split('T')[0];
    }

    const result = await this.repository.create({
      entity_id: entityId,
      property_id: params.property_id,
      asset_id: params.asset_id,
      supplier_id: params.supplier_id,
      title: params.title,
      description: params.description,
      service_type: params.service_type,
      frequency: params.frequency,
      frequency_days: days,
      start_date: params.start_date,
      end_date: params.end_date,
      next_service_date: nextServiceDate,
      sla_response_hours: params.sla_response_hours || 24,
      sla_completion_days: params.sla_completion_days || 7,
      contract_value: params.contract_value,
      status: 'active' as const,
    });

    return result;
  }

  async get(id: string): Promise<ServiceResult<ServiceContract>> {
    return this.repository.findById(id);
  }

  async list(entityId: string): Promise<ServiceResult<ServiceContract[]>> {
    return this.repository.findByEntity(entityId);
  }

  async listByAsset(assetId: string): Promise<ServiceResult<ServiceContract[]>> {
    return this.repository.findByAsset(assetId);
  }

  async update(id: string, params: Partial<CreateContractParams>): Promise<ServiceResult<ServiceContract>> {
    return this.repository.update(id, params);
  }

  async cancel(id: string, reason?: string): Promise<ServiceResult<ServiceContract>> {
    return this.repository.update(id, {
      status: 'cancelled',
      description: reason ? `Cancelled: ${reason}` : 'Cancelled',
    });
  }

  async findContractsNeedingService(today: string): Promise<ServiceResult<ServiceContract[]>> {
    return this.repository.findContractsNeedingService(today);
  }

  async recordService(id: string, serviceDate: string): Promise<ServiceResult<ServiceContract>> {
    const current = await this.repository.findById(id);
    if (!current.data) {
      return {
        error: { code: 'CONTRACT_NOT_FOUND', message: 'Contract not found' },
      };
    }

    let nextServiceDate: string | undefined = undefined;
    if (current.data.frequency_days) {
      const date = new Date(serviceDate);
      date.setDate(date.getDate() + current.data.frequency_days);
      nextServiceDate = date.toISOString().split('T')[0];
    }

    return this.repository.update(id, {
      last_service_date: serviceDate,
      next_service_date: nextServiceDate,
    });
  }
}

export const contractService = new ContractService();
