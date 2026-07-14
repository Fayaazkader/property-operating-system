// lib/brokerage/companies/company.service.ts
// Broker Company Service — Enterprise Grade

import { supabase } from "@/lib/supabase";
import { publish } from "@/lib/platform/events";
import { logger } from "@/lib/platform/events/logger.service";
import { CreateCompanyParams, UpdateCompanyParams, BrokerCompany } from './company.types';

// ============================================================
// STANDARD SERVICE RESULT TYPE
// ============================================================

export interface ServiceResult<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

// ============================================================
// COMPANY SERVICE
// ============================================================

export class CompanyService {
  private supabase = supabase;

  // ============================================================
  // CREATE
  // ============================================================

  async create(params: CreateCompanyParams, entityId: string): Promise<ServiceResult<BrokerCompany>> {
    try {
      const { data, error } = await this.supabase
        .from('broker_companies')
        .insert({
          entity_id: entityId,
          name: params.name,
          registration_number: params.registration_number,
          vat_number: params.vat_number,
          address: params.address,
          phone: params.phone,
          email: params.email,
          website: params.website,
          default_commission_rate: params.default_commission_rate || 5.0,
          default_commission_type: params.default_commission_type || 'percentage',
          status: 'active',
        })
        .select()
        .single();

      if (error || !data) {
        return {
          error: {
            code: 'COMPANY_CREATE_FAILED',
            message: error?.message || 'Failed to create company',
          },
        };
      }

      // Publish event
      await publish('broker.company.created', {
        correlationId: data.id,
        source: 'company-service',
        version: '1.0',
        entity: {
          id: data.id,
          type: 'broker_company',
        },
        payload: {
          companyId: data.id,
          name: data.name,
          entityId,
        },
      });

      logger.info('Broker company created', {
        companyId: data.id,
        entityId,
        companyName: data.name,
      });

      return { data: data as BrokerCompany };
    } catch (error) {
      return {
        error: {
          code: 'COMPANY_CREATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ============================================================
  // GET
  // ============================================================

  async get(id: string): Promise<ServiceResult<BrokerCompany>> {
    try {
      const { data, error } = await this.supabase
        .from('broker_companies')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return {
          error: {
            code: 'COMPANY_NOT_FOUND',
            message: error?.message || 'Company not found',
          },
        };
      }

      return { data: data as BrokerCompany };
    } catch (error) {
      return {
        error: {
          code: 'COMPANY_GET_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ============================================================
  // LIST
  // ============================================================

  async list(entityId: string, options?: { status?: string }): Promise<ServiceResult<BrokerCompany[]>> {
    try {
      let query = this.supabase
        .from('broker_companies')
        .select('*')
        .eq('entity_id', entityId)
        .order('name', { ascending: true });

      if (options?.status) {
        query = query.eq('status', options.status);
      }

      const { data, error } = await query;

      if (error) {
        return {
          error: {
            code: 'COMPANY_LIST_FAILED',
            message: error.message,
          },
        };
      }

      return { data: data as BrokerCompany[] };
    } catch (error) {
      return {
        error: {
          code: 'COMPANY_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ============================================================
  // UPDATE
  // ============================================================

  async update(id: string, params: UpdateCompanyParams): Promise<ServiceResult<BrokerCompany>> {
    try {
      // Build update payload with proper typing
      const updatePayload: Partial<BrokerCompany> = {};

      if (params.name !== undefined) updatePayload.name = params.name;
      if (params.registration_number !== undefined) updatePayload.registration_number = params.registration_number;
      if (params.vat_number !== undefined) updatePayload.vat_number = params.vat_number;
      if (params.address !== undefined) updatePayload.address = params.address;
      if (params.phone !== undefined) updatePayload.phone = params.phone;
      if (params.email !== undefined) updatePayload.email = params.email;
      if (params.website !== undefined) updatePayload.website = params.website;
      if (params.default_commission_rate !== undefined) updatePayload.default_commission_rate = params.default_commission_rate;
      if (params.default_commission_type !== undefined) updatePayload.default_commission_type = params.default_commission_type;
      if (params.status !== undefined) updatePayload.status = params.status;

      const { data, error } = await this.supabase
        .from('broker_companies')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        return {
          error: {
            code: 'COMPANY_UPDATE_FAILED',
            message: error?.message || 'Failed to update company',
          },
        };
      }

      // Publish event
      await publish('broker.company.updated', {
        correlationId: id,
        source: 'company-service',
        version: '1.0',
        entity: {
          id: data.id,
          type: 'broker_company',
        },
        payload: {
          companyId: data.id,
          updatedFields: Object.keys(updatePayload),
        },
      });

      logger.info('Broker company updated', {
        companyId: data.id,
        updatedFields: Object.keys(updatePayload),
      });

      return { data: data as BrokerCompany };
    } catch (error) {
      return {
        error: {
          code: 'COMPANY_UPDATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ============================================================
  // ARCHIVE — Soft delete
  // ============================================================

  async archive(id: string): Promise<ServiceResult<{ success: boolean }>> {
    try {
      const { error } = await this.supabase
        .from('broker_companies')
        .update({
          status: 'inactive',
        })
        .eq('id', id);

      if (error) {
        return {
          error: {
            code: 'COMPANY_ARCHIVE_FAILED',
            message: error.message,
          },
        };
      }

      await publish('broker.company.archived', {
        correlationId: id,
        source: 'company-service',
        version: '1.0',
        entity: {
          id: id,
          type: 'broker_company',
        },
        payload: { companyId: id },
      });

      logger.info('Broker company archived', { companyId: id });

      return { data: { success: true } };
    } catch (error) {
      return {
        error: {
          code: 'COMPANY_ARCHIVE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ============================================================
  // VERIFY FICA — Compliance workflow
  // ============================================================

  async verifyFica(id: string): Promise<ServiceResult<{ success: boolean }>> {
    try {
      const { error } = await this.supabase
        .from('broker_companies')
        .update({
          fica_verified: true,
          fica_verified_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        return {
          error: {
            code: 'COMPANY_FICA_FAILED',
            message: error.message,
          },
        };
      }

      await publish('broker.company.fica_verified', {
        correlationId: id,
        source: 'company-service',
        version: '1.0',
        entity: {
          id: id,
          type: 'broker_company',
        },
        payload: { companyId: id },
      });

      logger.info('Broker company FICA verified', { companyId: id });

      return { data: { success: true } };
    } catch (error) {
      return {
        error: {
          code: 'COMPANY_FICA_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ============================================================
  // DASHBOARD STUBS — Future implementation
  // ============================================================

  async getDashboard(companyId: string): Promise<ServiceResult<any>> {
    // TODO: Implement dashboard metrics
    // - Active brokers
    // - Active mandates
    // - Commission payable
    // - Total commissions paid
    // - Average lease value
    // - Conversion rate

    return {
      data: {
        companyId,
        message: 'Dashboard metrics coming soon',
      },
    };
  }

  async getPerformance(companyId: string): Promise<ServiceResult<any>> {
    // TODO: Implement performance metrics
    return {
      data: {
        companyId,
        message: 'Performance metrics coming soon',
      },
    };
  }

  async getMandates(companyId: string): Promise<ServiceResult<any>> {
    // TODO: Implement mandate summary
    return {
      data: {
        companyId,
        message: 'Mandate summary coming soon',
      },
    };
  }

  async getCommissionSummary(companyId: string): Promise<ServiceResult<any>> {
    // TODO: Implement commission summary
    return {
      data: {
        companyId,
        message: 'Commission summary coming soon',
      },
    };
  }
}

export const companyService = new CompanyService();
