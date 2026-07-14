// lib/property-operations/services/compliance.service.ts
// Compliance Service — Business Logic Layer

import { ServiceResult } from "@/lib/platform/types";
import { complianceRepository } from '../repositories/compliance.repository';
import { CreateComplianceParams, UpdateComplianceParams, ComplianceItem, ComplianceStatus } from '../compliance/compliance.types';
import { timelineService } from '../timeline/timeline.service';
import { publish } from '@/lib/platform/events';

export class ComplianceService {
  private repository = complianceRepository;

  async create(params: CreateComplianceParams, entityId: string): Promise<ServiceResult<ComplianceItem>> {
    const result = await this.repository.create({
      entity_id: entityId,
      property_id: params.property_id,
      asset_id: params.asset_id,
      name: params.name,
      type: params.type,
      reference_number: params.reference_number,
      issuing_authority: params.issuing_authority,
      issue_date: params.issue_date,
      expiry_date: params.expiry_date,
      reminder_days: params.reminder_days || 30,
      document_url: params.document_url,
      status: 'active' as ComplianceStatus,
    });

    if (result.data) {
      await timelineService.addEntry({
        entity_id: entityId,
        property_id: params.property_id,
        event_type: 'compliance_added',
        title: `Compliance item added: ${params.name}`,
        description: `Type: ${params.type}, Expires: ${params.expiry_date}`,
        reference_id: result.data.id,
        reference_type: 'compliance',
        source: 'compliance-service',
        created_by: entityId,
      });

      await publish('compliance.item.created', {
        correlationId: result.data.id,
        source: 'compliance-service',
        version: '1.0',
        entity: {
          id: result.data.id,
          type: 'compliance',
          propertyId: params.property_id,
        },
        payload: {
          complianceId: result.data.id,
          name: params.name,
          type: params.type,
          expiryDate: params.expiry_date,
        },
      });
    }

    return result;
  }

  async get(id: string): Promise<ServiceResult<ComplianceItem>> {
    return this.repository.findById(id);
  }

  async listByProperty(propertyId: string): Promise<ServiceResult<ComplianceItem[]>> {
    return this.repository.findByProperty(propertyId);
  }

  async list(entityId: string, options?: { status?: string; type?: string }): Promise<ServiceResult<ComplianceItem[]>> {
    return this.repository.findByEntity(entityId, options);
  }

  async listExpiringSoon(entityId: string, days?: number): Promise<ServiceResult<ComplianceItem[]>> {
    return this.repository.findExpiringSoon(entityId, days || 30);
  }

  async update(id: string, params: UpdateComplianceParams): Promise<ServiceResult<ComplianceItem>> {
    return this.repository.update(id, params);
  }

  async renew(id: string, newExpiryDate: string, documentUrl?: string): Promise<ServiceResult<ComplianceItem>> {
    const result = await this.repository.update(id, {
      expiry_date: newExpiryDate,
      status: 'renewed' as ComplianceStatus,
      document_url: documentUrl,
    });

    if (result.data) {
      await timelineService.addEntry({
        entity_id: result.data.entity_id!,
        property_id: result.data.property_id,
        event_type: 'compliance_renewed',
        title: `Compliance renewed: ${result.data.name}`,
        description: `New expiry: ${newExpiryDate}`,
        reference_id: result.data.id,
        reference_type: 'compliance',
        source: 'compliance-service',
        created_by: 'system',
      });

      await publish('compliance.item.renewed', {
        correlationId: id,
        source: 'compliance-service',
        version: '1.0',
        entity: {
          id: result.data.id,
          type: 'compliance',
          propertyId: result.data.property_id,
        },
        payload: {
          complianceId: result.data.id,
          name: result.data.name,
          newExpiryDate,
        },
      });
    }

    return result;
  }

  async checkExpiryStatuses(): Promise<ServiceResult<{ updated: number }>> {
    const today = new Date().toISOString().split('T')[0];
    const future = new Date();
    future.setDate(future.getDate() + 30);
    const futureStr = future.toISOString().split('T')[0];

    // Get all active items expiring within 30 days
    const { data: items } = await this.repository.findByEntity('*', {});
    if (!items) {
      return { data: { updated: 0 } };
    }

    let updated = 0;
    for (const item of items) {
      if (item.status !== 'active') continue;
      
      const expiryDate = new Date(item.expiry_date);
      const now = new Date();
      const daysUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

      if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
        await this.repository.update(item.id, {
          status: 'expiring' as ComplianceStatus,
        });
        updated++;
      } else if (daysUntilExpiry <= 0) {
        await this.repository.update(item.id, {
          status: 'expired' as ComplianceStatus,
        });
        updated++;
      }
    }

    return { data: { updated } };
  }
}

export const complianceService = new ComplianceService();
