// lib/property-operations/services/work-order.service.ts
// Work Order Service — Business Logic Layer

import { ServiceResult } from "@/lib/platform/types";
import { workOrderRepository } from '../repositories/work-order.repository';
import { CreateWorkOrderParams, UpdateWorkOrderParams, WorkOrder, WorkOrderStatus } from '../work-orders/work-order.types';
import { timelineService } from '../timeline/timeline.service';
import { publish } from '@/lib/platform/events';
import { slaEngine } from '@/lib/platform/policies/sla.engine';

export class WorkOrderService {
  private repository = workOrderRepository;

  async create(params: CreateWorkOrderParams, entityId: string): Promise<ServiceResult<WorkOrder>> {
    const slaDeadline = slaEngine.calculateResponseDeadline(
      params.priority || 'medium',
      undefined
    );

    const result = await this.repository.create({
      entity_id: entityId,
      property_id: params.property_id,
      unit_id: params.unit_id,
      tenant_id: params.tenant_id,
      asset_id: params.asset_id,
      inspection_id: params.inspection_id,
      title: params.title,
      description: params.description,
      priority: params.priority || 'medium',
      status: 'reported' as WorkOrderStatus,
      assigned_to: params.assigned_to,
      source: params.source || 'tenant',
      source_id: params.source_id,
      estimated_cost: params.estimated_cost,
      tenant_notes: params.tenant_notes,
      sla_response_at: slaDeadline.toISOString(),
      sla_breached: false,
    });

    if (result.data) {
      await this.repository.addEvent(result.data.id, {
        event_type: 'reported',
        description: 'Work order reported',
        changed_by_type: 'system',
      });

      await timelineService.addEntry({
        entity_id: entityId,
        property_id: params.property_id,
        event_type: 'work_order_created',
        title: `Work order created: ${params.title}`,
        description: `Priority: ${params.priority || 'medium'}`,
        reference_id: result.data.id,
        reference_type: 'work_order',
        source: 'work-order-service',
        created_by: entityId,
      });

      await publish('work.order.created', {
        correlationId: result.data.id,
        source: 'work-order-service',
        version: '1.0',
        entity: {
          id: result.data.id,
          type: 'work_order',
          propertyId: params.property_id,
        },
        payload: {
          workOrderId: result.data.id,
          title: params.title,
          priority: params.priority || 'medium',
          propertyId: params.property_id,
        },
      });
    }

    return result;
  }

  async get(id: string): Promise<ServiceResult<WorkOrder>> {
    const result = await this.repository.findById(id);
    if (result.data) {
      const events = await this.repository.getEvents(id);
      result.data.timeline = events.data || [];
    }
    return result;
  }

  async listByProperty(propertyId: string): Promise<ServiceResult<WorkOrder[]>> {
    return this.repository.findByProperty(propertyId);
  }

  async listByTenant(tenantId: string): Promise<ServiceResult<WorkOrder[]>> {
    return this.repository.findByTenant(tenantId);
  }

  async listBySupplier(supplierId: string): Promise<ServiceResult<WorkOrder[]>> {
    return this.repository.findBySupplier(supplierId);
  }

  async list(entityId: string, options?: { status?: string; priority?: string; fromDate?: string; toDate?: string }): Promise<ServiceResult<WorkOrder[]>> {
    return this.repository.findByEntity(entityId, options);
  }

  async update(id: string, params: UpdateWorkOrderParams): Promise<ServiceResult<WorkOrder>> {
    return this.repository.update(id, params);
  }

  async transition(id: string, status: WorkOrderStatus, note?: string): Promise<ServiceResult<WorkOrder>> {
    const current = await this.repository.findById(id);
    if (!current.data) {
      return {
        error: { code: 'WORK_ORDER_NOT_FOUND', message: 'Work order not found' },
      };
    }

    const result = await this.repository.update(id, {
      status,
      ...(status === 'assigned' && { assigned_at: new Date().toISOString() }),
      ...(status === 'completed' && { completed_at: new Date().toISOString() }),
    });

    if (result.data) {
      await this.repository.addEvent(id, {
        event_type: status,
        description: `Status changed to ${status}`,
        note: note || '',
        changed_by_type: 'system',
      });

      if (status === 'completed') {
        await publish('work.order.completed', {
          correlationId: id,
          source: 'work-order-service',
          version: '1.0',
          entity: {
            id: result.data.id,
            type: 'work_order',
            propertyId: result.data.property_id,
          },
          payload: {
            workOrderId: result.data.id,
            title: result.data.title,
            propertyId: result.data.property_id,
          },
        });
      }
    }

    return result;
  }

  async assign(id: string, supplierId: string): Promise<ServiceResult<WorkOrder>> {
    const result = await this.repository.update(id, {
      assigned_to: supplierId,
      status: 'assigned',
      assigned_at: new Date().toISOString(),
    });

    if (result.data) {
      await this.repository.addEvent(id, {
        event_type: 'assigned',
        description: `Assigned to supplier`,
        changed_by_type: 'system',
      });
    }

    return result;
  }

  async checkSLA(id: string): Promise<ServiceResult<{ status: string; remaining_hours: number }>> {
    const current = await this.repository.findById(id);
    if (!current.data) {
      return {
        error: { code: 'WORK_ORDER_NOT_FOUND', message: 'Work order not found' },
      };
    }

    const slaStatus = slaEngine.getSLAStatus(
      current.data.created_at,
      current.data.priority || 'medium',
      undefined
    );

    return { data: slaStatus };
  }

  async updateSLA(id: string): Promise<ServiceResult<WorkOrder>> {
    const current = await this.repository.findById(id);
    if (!current.data) {
      return {
        error: { code: 'WORK_ORDER_NOT_FOUND', message: 'Work order not found' },
      };
    }

    const slaStatus = slaEngine.getSLAStatus(
      current.data.created_at,
      current.data.priority || 'medium',
      undefined
    );

    const isBreached = slaStatus.status === 'breached';

    const result = await this.repository.update(id, {
      sla_breached: isBreached,
    });

    if (result.data && isBreached) {
      await this.repository.addEvent(id, {
        event_type: 'sla_breached',
        description: 'SLA breached',
        changed_by_type: 'system',
      });

      await publish('work.order.sla.breached', {
        correlationId: id,
        source: 'work-order-service',
        version: '1.0',
        entity: {
          id: result.data.id,
          type: 'work_order',
          propertyId: result.data.property_id,
        },
        payload: {
          workOrderId: result.data.id,
          title: result.data.title,
          priority: result.data.priority,
        },
      });
    }

    return result;
  }
}

export const workOrderService = new WorkOrderService();
