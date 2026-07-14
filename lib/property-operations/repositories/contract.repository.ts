// lib/property-operations/repositories/contract.repository.ts
// Contract Repository — Persistence Abstraction

import { supabase } from "@/lib/supabase";
import { ServiceResult } from "@/lib/platform/types";
import { ServiceContract, CreateContractParams } from '../types';

export class ContractRepository {
  private supabase = supabase;

  async create(data: any): Promise<ServiceResult<ServiceContract>> {
    try {
      const { data: result, error } = await this.supabase
        .from('service_contracts')
        .insert(data)
        .select()
        .single();

      if (error || !result) {
        return {
          error: { code: 'CONTRACT_CREATE_FAILED', message: error?.message || 'Failed to create contract' },
        };
      }

      return { data: result as ServiceContract };
    } catch (error) {
      return {
        error: {
          code: 'CONTRACT_CREATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async findById(id: string): Promise<ServiceResult<ServiceContract>> {
    try {
      const { data, error } = await this.supabase
        .from('service_contracts')
        .select('*, asset:assets(name), supplier:suppliers(name), property:properties(property_name)')
        .eq('id', id)
        .single();

      if (error || !data) {
        return {
          error: { code: 'CONTRACT_NOT_FOUND', message: error?.message || 'Contract not found' },
        };
      }

      return { data: data as ServiceContract };
    } catch (error) {
      return {
        error: {
          code: 'CONTRACT_GET_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async findByEntity(entityId: string): Promise<ServiceResult<ServiceContract[]>> {
    try {
      const { data, error } = await this.supabase
        .from('service_contracts')
        .select('*, asset:assets(name), supplier:suppliers(name), property:properties(property_name)')
        .eq('entity_id', entityId)
        .eq('status', 'active')
        .order('start_date', { ascending: false });

      if (error) {
        return {
          error: { code: 'CONTRACT_LIST_FAILED', message: error.message },
        };
      }

      return { data: data as ServiceContract[] };
    } catch (error) {
      return {
        error: {
          code: 'CONTRACT_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async findByAsset(assetId: string): Promise<ServiceResult<ServiceContract[]>> {
    try {
      const { data, error } = await this.supabase
        .from('service_contracts')
        .select('*')
        .eq('asset_id', assetId)
        .eq('status', 'active')
        .order('start_date', { ascending: false });

      if (error) {
        return {
          error: { code: 'CONTRACT_LIST_FAILED', message: error.message },
        };
      }

      return { data: data as ServiceContract[] };
    } catch (error) {
      return {
        error: {
          code: 'CONTRACT_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async update(id: string, data: Partial<ServiceContract>): Promise<ServiceResult<ServiceContract>> {
    try {
      const { data: result, error } = await this.supabase
        .from('service_contracts')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error || !result) {
        return {
          error: { code: 'CONTRACT_UPDATE_FAILED', message: error?.message || 'Failed to update contract' },
        };
      }

      return { data: result as ServiceContract };
    } catch (error) {
      return {
        error: {
          code: 'CONTRACT_UPDATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async findContractsNeedingService(today: string): Promise<ServiceResult<ServiceContract[]>> {
    try {
      const { data, error } = await this.supabase
        .from('service_contracts')
        .select('*, asset:assets(name), supplier:suppliers(name)')
        .eq('status', 'active')
        .lte('next_service_date', today)
        .order('next_service_date', { ascending: true });

      if (error) {
        return {
          error: { code: 'CONTRACT_LIST_FAILED', message: error.message },
        };
      }

      return { data: data as ServiceContract[] };
    } catch (error) {
      return {
        error: {
          code: 'CONTRACT_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}

export const contractRepository = new ContractRepository();
