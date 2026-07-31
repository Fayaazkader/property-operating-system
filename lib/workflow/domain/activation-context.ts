// lib/workflow/domain/activation-context.ts
// Shared types for the Lease Activation Workflow

export interface ReviewModel {
  company: {
    tenantName: string;
    registration: string;
    vatNumber: string;
    email: string;
    phone: string;
  };
  lease: {
    monthlyRental: number;
    startDate: string;
    endDate: string;
    escalationPercent: number;
    depositAmount: number;
    parkingBays: number;
    parkingRate: number;
  };
  property: {
    propertyId: string;
    propertyName: string;
    unitId: string;
    unitNumber: string;
  };
  billableItems: BillableItem[];
  documents: { fileName: string; fileUrl: string }[];
  exceptions: { field: string; message: string; severity: 'warning' | 'error' }[];
}

export interface BillableItem {
  id: string;
  description: string;
  amount: number;
  selected: boolean;
  source: string;
  confidence: number;
}

export interface ActivationResult {
  tenantId: string;
  leaseId: string;
  tenantCode: string;
  leaseRef: string;
  rulesCreated: number;
  chargesGenerated: number;
  documentsAttached: number;
  contactsCreated: number;
  warnings: number;
  duration: number;
  events: string[];
}

export interface ActivateLeaseRpcResult {
  tenant_id: string;
  lease_id: string;
  tenant_code: string;
  lease_ref: string;
  documents_attached: number;
  contacts_created: number;
  duration_ms: number;
}
