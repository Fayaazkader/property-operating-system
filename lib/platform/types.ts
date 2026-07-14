// lib/platform/types.ts
// Shared Platform Types — Used across all engines

export interface OperationResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  warnings?: {
    code: string;
    message: string;
  }[];
  correlationId: string;
  metadata?: Record<string, any>;
}

// ============================================================
// SERVICE RESULT — For persistence layer
// ============================================================

export interface ServiceResult<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

export interface PlatformError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface PlatformWarning {
  code: string;
  message: string;
}

// ============================================================
// SHARED ENUMS
// ============================================================

export const BrokerStatus = {
  Active: 'active',
  Inactive: 'inactive',
  Suspended: 'suspended',
} as const;

export type BrokerStatusType = typeof BrokerStatus[keyof typeof BrokerStatus];

export const MandateStatus = {
  Pending: 'pending',
  Accepted: 'accepted',
  Declined: 'declined',
  Expired: 'expired',
  Completed: 'completed',
} as const;

export type MandateStatusType = typeof MandateStatus[keyof typeof MandateStatus];

export const CompanyStatus = {
  Active: 'active',
  Inactive: 'inactive',
} as const;

export type CompanyStatusType = typeof CompanyStatus[keyof typeof CompanyStatus];

export const CommissionType = {
  Percentage: 'percentage',
  Fixed: 'fixed',
  Tiered: 'tiered',
} as const;

export type CommissionTypeType = typeof CommissionType[keyof typeof CommissionType];
