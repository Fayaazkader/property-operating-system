// lib/property-operations/services/inspection.service.ts
// Inspection Service — Business Logic Layer

import { ServiceResult } from "@/lib/platform/types";
import { inspectionRepository } from '../repositories/inspection.repository';
import { CreateInspectionParams, UpdateInspectionParams, Inspection } from '../inspections/inspection.types';
import { timelineService } from '../timeline/timeline.service';

export class InspectionService {
  private repository = inspectionRepository;

  async create(params: CreateInspectionParams, entityId: string): Promise<ServiceResult<Inspection>> {
    const result = await this.repository.create({
      entity_id: entityId,
      property_id: params.property_id,
      asset_id: params.asset_id,
      unit_id: params.unit_id,
      title: params.title,
      type: params.type,
      scheduled_date: params.scheduled_date,
      inspector: params.inspector,
      inspector_company: params.inspector_company,
      checklist: params.checklist || [],
      status: 'scheduled',
    });

    if (result.data) {
      await timelineService.addEntry({
        entity_id: entityId,
        property_id: params.property_id,
        event_type: 'inspection_scheduled',
        title: `Inspection scheduled: ${params.title}`,
        description: `Type: ${params.type}, Date: ${params.scheduled_date}`,
        reference_id: result.data.id,
        reference_type: 'inspection',
        source: 'inspection-service',
        created_by: entityId,
      });
    }

    return result;
  }

  async get(id: string): Promise<ServiceResult<Inspection>> {
    return this.repository.findById(id);
  }

  async listByProperty(propertyId: string): Promise<ServiceResult<Inspection[]>> {
    return this.repository.findByProperty(propertyId);
  }

  async list(entityId: string, options?: { status?: string; fromDate?: string; toDate?: string }): Promise<ServiceResult<Inspection[]>> {
    return this.repository.findByEntity(entityId, options);
  }

  async update(id: string, params: UpdateInspectionParams): Promise<ServiceResult<Inspection>> {
    return this.repository.update(id, params);
  }

  async complete(id: string, findings: string, severity: 'low' | 'medium' | 'high' | 'critical', report_url?: string): Promise<ServiceResult<Inspection>> {
    const result = await this.repository.update(id, {
      status: 'completed',
      completed_date: new Date().toISOString().split('T')[0],
      findings,
      severity,
      report_url,
    });

    if (result.data) {
      await timelineService.addEntry({
        entity_id: result.data.entity_id!,
        property_id: result.data.property_id,
        event_type: 'inspection_completed',
        title: `Inspection completed: ${result.data.title}`,
        description: `Severity: ${severity}`,
        reference_id: result.data.id,
        reference_type: 'inspection',
        source: 'inspection-service',
        created_by: 'system',
      });
    }

    return result;
  }

  // Work orders are now queried separately by inspection_id
  // Get work orders for this inspection
  async getWorkOrders(inspectionId: string): Promise<ServiceResult<any[]>> {
    try {
      const { workOrderRepository } = await import('../repositories/work-order.repository');
      const { data, error } = await workOrderRepository.findByInspection(inspectionId);
      if (error) {
        return { error };
      }
      return { data };
    } catch (error) {
      return {
        error: {
          code: 'WORK_ORDER_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}

export const inspectionService = new InspectionService();
