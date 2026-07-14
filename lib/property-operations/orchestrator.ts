// lib/property-operations/orchestrator.ts
// Property Operations Orchestrator — Brings all services together

import { ServiceResult } from "@/lib/platform/types";
import { assetService } from './services/asset.service';
import { contractService } from './services/contract.service';
import { inspectionService } from './services/inspection.service';
import { workOrderService } from './services/work-order.service';
import { supplierService } from './services/supplier.service';
import { purchaseOrderService } from './services/po.service';
import { complianceService } from './services/compliance.service';
import { timelineService } from './timeline/timeline.service';
import {
  Asset,
  CreateAssetParams,
  UpdateAssetParams,
  ServiceContract,
  CreateContractParams,
  Inspection,
  CreateInspectionParams,
  UpdateInspectionParams,
  WorkOrder,
  CreateWorkOrderParams,
  UpdateWorkOrderParams,
  WorkOrderStatus,
  Supplier,
  CreateSupplierParams,
  UpdateSupplierParams,
  PurchaseOrder,
  CreatePurchaseOrderParams,
  UpdatePurchaseOrderParams,
  ComplianceItem,
  CreateComplianceParams,
  UpdateComplianceParams,
} from './index';

export class PropertyOrchestrator {
  // ============================================================
  // ASSET LIFECYCLE
  // ============================================================

  async createAsset(params: CreateAssetParams, entityId: string): Promise<ServiceResult<Asset>> {
    return assetService.create(params, entityId);
  }

  async getAsset(id: string): Promise<ServiceResult<Asset>> {
    return assetService.get(id);
  }

  async listAssets(entityId: string): Promise<ServiceResult<Asset[]>> {
    return assetService.list(entityId);
  }

  async updateAsset(id: string, params: UpdateAssetParams): Promise<ServiceResult<Asset>> {
    return assetService.update(id, params);
  }

  async recordAssetService(id: string, serviceDate: string, notes?: string): Promise<ServiceResult<Asset>> {
    return assetService.recordService(id, serviceDate, notes);
  }

  async updateAssetStatus(id: string, status: Asset['status'], reason?: string): Promise<ServiceResult<Asset>> {
    return assetService.updateStatus(id, status, reason);
  }

  // ============================================================
  // SERVICE CONTRACT LIFECYCLE
  // ============================================================

  async createContract(params: CreateContractParams, entityId: string): Promise<ServiceResult<ServiceContract>> {
    return contractService.create(params, entityId);
  }

  async getContract(id: string): Promise<ServiceResult<ServiceContract>> {
    return contractService.get(id);
  }

  async listContracts(entityId: string): Promise<ServiceResult<ServiceContract[]>> {
    return contractService.list(entityId);
  }

  async listContractsByAsset(assetId: string): Promise<ServiceResult<ServiceContract[]>> {
    return contractService.listByAsset(assetId);
  }

  async updateContract(id: string, params: Partial<CreateContractParams>): Promise<ServiceResult<ServiceContract>> {
    return contractService.update(id, params);
  }

  async cancelContract(id: string, reason?: string): Promise<ServiceResult<ServiceContract>> {
    return contractService.cancel(id, reason);
  }

  async recordContractService(id: string, serviceDate: string): Promise<ServiceResult<ServiceContract>> {
    return contractService.recordService(id, serviceDate);
  }

  // ============================================================
  // INSPECTION LIFECYCLE
  // ============================================================

  async createInspection(params: CreateInspectionParams, entityId: string): Promise<ServiceResult<Inspection>> {
    return inspectionService.create(params, entityId);
  }

  async getInspection(id: string): Promise<ServiceResult<Inspection>> {
    return inspectionService.get(id);
  }

  async listInspections(entityId: string, options?: { status?: string; fromDate?: string; toDate?: string }): Promise<ServiceResult<Inspection[]>> {
    return inspectionService.list(entityId, options);
  }

  async updateInspection(id: string, params: UpdateInspectionParams): Promise<ServiceResult<Inspection>> {
    return inspectionService.update(id, params);
  }

  async completeInspection(
    id: string,
    findings: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    reportUrl?: string
  ): Promise<ServiceResult<Inspection>> {
    return inspectionService.complete(id, findings, severity, reportUrl);
  }

  async getInspectionWorkOrders(inspectionId: string): Promise<ServiceResult<WorkOrder[]>> {
    return inspectionService.getWorkOrders(inspectionId);
  }

  // ============================================================
  // WORK ORDER LIFECYCLE
  // ============================================================

  async createWorkOrder(params: CreateWorkOrderParams, entityId: string): Promise<ServiceResult<WorkOrder>> {
    return workOrderService.create(params, entityId);
  }

  async getWorkOrder(id: string): Promise<ServiceResult<WorkOrder>> {
    return workOrderService.get(id);
  }

  async listWorkOrders(entityId: string, options?: { status?: string; priority?: string; fromDate?: string; toDate?: string }): Promise<ServiceResult<WorkOrder[]>> {
    return workOrderService.list(entityId, options);
  }

  async listWorkOrdersByProperty(propertyId: string): Promise<ServiceResult<WorkOrder[]>> {
    return workOrderService.listByProperty(propertyId);
  }

  async listWorkOrdersByTenant(tenantId: string): Promise<ServiceResult<WorkOrder[]>> {
    return workOrderService.listByTenant(tenantId);
  }

  async listWorkOrdersBySupplier(supplierId: string): Promise<ServiceResult<WorkOrder[]>> {
    return workOrderService.listBySupplier(supplierId);
  }

  async updateWorkOrder(id: string, params: UpdateWorkOrderParams): Promise<ServiceResult<WorkOrder>> {
    return workOrderService.update(id, params);
  }

  async transitionWorkOrder(id: string, status: WorkOrderStatus, note?: string): Promise<ServiceResult<WorkOrder>> {
    return workOrderService.transition(id, status, note);
  }

  async assignWorkOrder(id: string, supplierId: string): Promise<ServiceResult<WorkOrder>> {
    return workOrderService.assign(id, supplierId);
  }

  async checkWorkOrderSLA(id: string): Promise<ServiceResult<{ status: string; remaining_hours: number }>> {
    return workOrderService.checkSLA(id);
  }

  async updateWorkOrderSLA(id: string): Promise<ServiceResult<WorkOrder>> {
    return workOrderService.updateSLA(id);
  }

  // ============================================================
  // SUPPLIER LIFECYCLE
  // ============================================================

  async createSupplier(params: CreateSupplierParams, entityId: string): Promise<ServiceResult<Supplier>> {
    return supplierService.create(params, entityId);
  }

  async getSupplier(id: string): Promise<ServiceResult<Supplier>> {
    return supplierService.get(id);
  }

  async listSuppliers(entityId: string, options?: { status?: string; category?: string }): Promise<ServiceResult<Supplier[]>> {
    return supplierService.list(entityId, options);
  }

  async updateSupplier(id: string, params: UpdateSupplierParams): Promise<ServiceResult<Supplier>> {
    return supplierService.update(id, params);
  }

  async verifySupplierInsurance(id: string): Promise<ServiceResult<Supplier>> {
    return supplierService.verifyInsurance(id);
  }

  async verifySupplierFICA(id: string): Promise<ServiceResult<Supplier>> {
    return supplierService.verifyFICA(id);
  }

  async updateSupplierPerformance(id: string, rating: number, completed: boolean): Promise<ServiceResult<Supplier>> {
    return supplierService.updatePerformance(id, rating, completed);
  }

  // ============================================================
  // PURCHASE ORDER LIFECYCLE
  // ============================================================

  async createPurchaseOrder(params: CreatePurchaseOrderParams, entityId: string): Promise<ServiceResult<PurchaseOrder>> {
    return purchaseOrderService.create(params, entityId);
  }

  async getPurchaseOrder(id: string): Promise<ServiceResult<PurchaseOrder>> {
    return purchaseOrderService.get(id);
  }

  async listPurchaseOrders(entityId: string, options?: { status?: string }): Promise<ServiceResult<PurchaseOrder[]>> {
    return purchaseOrderService.list(entityId, options);
  }

  async listPurchaseOrdersByWorkOrder(workOrderId: string): Promise<ServiceResult<PurchaseOrder[]>> {
    return purchaseOrderService.listByWorkOrder(workOrderId);
  }

  async listPurchaseOrdersBySupplier(supplierId: string): Promise<ServiceResult<PurchaseOrder[]>> {
    return purchaseOrderService.listBySupplier(supplierId);
  }

  async updatePurchaseOrder(id: string, params: UpdatePurchaseOrderParams): Promise<ServiceResult<PurchaseOrder>> {
    return purchaseOrderService.update(id, params);
  }

  async approvePurchaseOrder(id: string, approvedBy: string, notes?: string): Promise<ServiceResult<PurchaseOrder>> {
    return purchaseOrderService.approve(id, approvedBy, notes);
  }

  async sendPurchaseOrder(id: string): Promise<ServiceResult<PurchaseOrder>> {
    return purchaseOrderService.send(id);
  }

  async completePurchaseOrder(id: string): Promise<ServiceResult<PurchaseOrder>> {
    return purchaseOrderService.complete(id);
  }

  // ============================================================
  // COMPLIANCE LIFECYCLE
  // ============================================================

  async createCompliance(params: CreateComplianceParams, entityId: string): Promise<ServiceResult<ComplianceItem>> {
    return complianceService.create(params, entityId);
  }

  async getCompliance(id: string): Promise<ServiceResult<ComplianceItem>> {
    return complianceService.get(id);
  }

  async listCompliance(entityId: string, options?: { status?: string; type?: string }): Promise<ServiceResult<ComplianceItem[]>> {
    return complianceService.list(entityId, options);
  }

  async listComplianceExpiringSoon(entityId: string, days?: number): Promise<ServiceResult<ComplianceItem[]>> {
    return complianceService.listExpiringSoon(entityId, days);
  }

  async updateCompliance(id: string, params: UpdateComplianceParams): Promise<ServiceResult<ComplianceItem>> {
    return complianceService.update(id, params);
  }

  async renewCompliance(id: string, newExpiryDate: string, documentUrl?: string): Promise<ServiceResult<ComplianceItem>> {
    return complianceService.renew(id, newExpiryDate, documentUrl);
  }

  async checkComplianceExpiries(): Promise<ServiceResult<{ updated: number }>> {
    return complianceService.checkExpiryStatuses();
  }

  // ============================================================
  // DASHBOARD METRICS
  // ============================================================

  async getDashboardMetrics(entityId: string): Promise<ServiceResult<any>> {
    try {
      const [
        assetsRes,
        workOrdersRes,
        inspectionsRes,
        suppliersRes,
        complianceRes,
      ] = await Promise.all([
        assetService.list(entityId),
        workOrderService.list(entityId),
        inspectionService.list(entityId),
        supplierService.list(entityId),
        complianceService.list(entityId),
      ]);

      const assets = assetsRes.data || [];
      const workOrders = workOrdersRes.data || [];
      const inspections = inspectionsRes.data || [];
      const suppliers = suppliersRes.data || [];
      const compliance = complianceRes.data || [];

      const openWorkOrders = workOrders.filter((w: WorkOrder) => 
        !['completed', 'closed', 'cancelled'].includes(w.status)
      ).length;

      const highPriority = workOrders.filter((w: WorkOrder) => 
        w.priority === 'high' || w.priority === 'emergency'
      ).length;

      const expiringCompliance = compliance.filter((c: ComplianceItem) => 
        c.status === 'expiring'
      ).length;

      const overdueCompliance = compliance.filter((c: ComplianceItem) => 
        c.status === 'expired'
      ).length;

      const activeSuppliers = suppliers.filter((s: Supplier) => 
        s.status === 'active'
      ).length;

      return {
        data: {
          total_assets: assets.length,
          open_work_orders: openWorkOrders,
          high_priority: highPriority,
          total_inspections: inspections.length,
          active_suppliers: activeSuppliers,
          expiring_compliance: expiringCompliance,
          overdue_compliance: overdueCompliance,
        },
      };
    } catch (error) {
      return {
        error: {
          code: 'DASHBOARD_METRICS_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ============================================================
  // TIMELINE
  // ============================================================

  async getPropertyTimeline(propertyId: string): Promise<ServiceResult<any[]>> {
    return timelineService.getByProperty(propertyId);
  }
}

export const propertyOrchestrator = new PropertyOrchestrator();
