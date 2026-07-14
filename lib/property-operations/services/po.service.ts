// lib/property-operations/services/po.service.ts
// Purchase Order Service — Business Logic Layer

import { ServiceResult } from "@/lib/platform/types";
import { purchaseOrderRepository } from '../repositories/po.repository';
import { CreatePurchaseOrderParams, UpdatePurchaseOrderParams, PurchaseOrder, POStatus } from '../purchase-orders/po.types';
import { publish } from '@/lib/platform/events';

export class PurchaseOrderService {
  private repository = purchaseOrderRepository;

  async create(params: CreatePurchaseOrderParams, entityId: string): Promise<ServiceResult<PurchaseOrder>> {
    const result = await this.repository.create({
      entity_id: entityId,
      work_order_id: params.work_order_id,
      supplier_id: params.supplier_id,
      po_number: params.po_number,
      description: params.description,
      amount: params.amount,
      status: 'draft' as POStatus,
    });

    if (result.data) {
      await publish('purchase.order.created', {
        correlationId: result.data.id,
        source: 'po-service',
        version: '1.0',
        entity: {
          id: result.data.id,
          type: 'purchase_order',
        },
        payload: {
          poId: result.data.id,
          poNumber: result.data.po_number,
          amount: result.data.amount,
        },
      });
    }

    return result;
  }

  async get(id: string): Promise<ServiceResult<PurchaseOrder>> {
    return this.repository.findById(id);
  }

  async listByWorkOrder(workOrderId: string): Promise<ServiceResult<PurchaseOrder[]>> {
    return this.repository.findByWorkOrder(workOrderId);
  }

  async listBySupplier(supplierId: string): Promise<ServiceResult<PurchaseOrder[]>> {
    return this.repository.findBySupplier(supplierId);
  }

  async list(entityId: string, options?: { status?: string }): Promise<ServiceResult<PurchaseOrder[]>> {
    return this.repository.findByEntity(entityId, options);
  }

  async update(id: string, params: UpdatePurchaseOrderParams): Promise<ServiceResult<PurchaseOrder>> {
    return this.repository.update(id, params);
  }

  async approve(id: string, approvedBy: string, notes?: string): Promise<ServiceResult<PurchaseOrder>> {
    const result = await this.repository.update(id, {
      status: 'approved' as POStatus,
      approved_date: new Date().toISOString().split('T')[0],
      approved_by: approvedBy,
      approval_notes: notes,
    });

    if (result.data) {
      await publish('purchase.order.approved', {
        correlationId: id,
        source: 'po-service',
        version: '1.0',
        entity: {
          id: result.data.id,
          type: 'purchase_order',
        },
        payload: {
          poId: result.data.id,
          poNumber: result.data.po_number,
          approvedBy,
        },
      });
    }

    return result;
  }

  async send(id: string): Promise<ServiceResult<PurchaseOrder>> {
    return this.repository.update(id, {
      status: 'sent' as POStatus,
      issued_date: new Date().toISOString().split('T')[0],
    });
  }

  async complete(id: string): Promise<ServiceResult<PurchaseOrder>> {
    const result = await this.repository.update(id, {
      status: 'completed' as POStatus,
      completed_date: new Date().toISOString().split('T')[0],
    });

    if (result.data) {
      await publish('purchase.order.completed', {
        correlationId: id,
        source: 'po-service',
        version: '1.0',
        entity: {
          id: result.data.id,
          type: 'purchase_order',
        },
        payload: {
          poId: result.data.id,
          poNumber: result.data.po_number,
        },
      });
    }

    return result;
  }
}

export const purchaseOrderService = new PurchaseOrderService();
