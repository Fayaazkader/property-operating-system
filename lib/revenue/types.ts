// lib/revenue/types.ts
// Shared types for Revenue Operations

export interface BillingCharge {
  type: string;
  description: string;
  amount: number;
  vatAmount: number;
  total: number;
  source: string;
  status: string;
  glCode?: string;
}

export interface BillingDocument {
  name: string;
  level: string;
  url: string;
  type: string;
}

export interface BillingTenant {
  entityId: string;
  tenantId: string;
  tenantName: string;
  property_name: string;
  leaseId: string;
  leaseRef: string;
  charges: BillingCharge[];
  documents: BillingDocument[];
  warnings: string[];
  total: number;
  ready: boolean;
}

export interface RevenueContext {
  entityId: string;
  periodName: string;
  periodStart: string;
  periodEnd: string;
  tenants: BillingTenant[];
  isAlreadyBilled: boolean;
  totalExpected: number;
}
