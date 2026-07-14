// lib/platform/events/contract.ts
// Platform Event Contract — Every event in AssetFlow follows this shape

export interface PlatformEvent<TPayload = any> {
  eventId: string;
  correlationId: string;
  eventName: string;
  source: string;
  version: string;
  timestamp: string;
  actor?: {
    id: string;
    type: 'user' | 'system' | 'tenant';
    email?: string;
  };
  entity?: {
    id: string;
    type: string;
    tenantId?: string;
    propertyId?: string;
  };
  payload: TPayload;
  metadata?: Record<string, unknown>;
}

// ============================================================
// DOMAIN EVENT TYPES
// ============================================================

export interface LeaseExecutedPayload {
  executionId: string;
  leaseId: string;
  executedAt: string;
  version: number;
  participants: number;
}

export interface LeaseActivatedPayload {
  intakeId: string;
  leaseId: string;
  activatedAt: string;
  monthlyRental: number;
}

export interface LeaseExpiringPayload {
  leaseId: string;
  tenantId: string;
  expiresAt: string;
  daysRemaining: number;
}

export interface StatementGeneratedPayload {
  statementId: string;
  tenantId: string;
  period: string;
  amount: number;
  url: string;
}

export interface PaymentReceivedPayload {
  paymentId: string;
  tenantId: string;
  amount: number;
  date: string;
  reference: string;
}

export interface MaintenanceCompletedPayload {
  ticketId: string;
  tenantId: string;
  completedAt: string;
}
