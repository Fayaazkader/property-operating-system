// lib/platform/security/types.ts
// Security Type Definitions

export type Permission = 
  | 'view' | 'create' | 'update' | 'delete' | 'approve' | 'reject'
  | 'assign' | 'archive' | 'restore' | 'delegate';

export type ResourceType = 
  | 'lease' | 'tenant' | 'property' | 'unit' | 'work_order' 
  | 'invoice' | 'payment' | 'supplier' | 'contract' | 'asset'
  | 'inspection' | 'compliance' | 'purchase_order' | 'broker'
  | 'commission' | 'user' | 'role' | 'entity' | 'report';

export interface ResourcePermission {
  resource: ResourceType;
  permissions: Permission[];
}

export interface AuditEntry {
  id: string;
  entity_id: string;
  entity_type: ResourceType;
  action: string;
  changes?: Record<string, any>;
  actor_id: string;
  actor_email: string;
  actor_role: string;
  correlation_id: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  metadata?: Record<string, any>;
}

export interface ApprovalRequest {
  id: string;
  action: string;
  entity_id: string;
  entity_type: string;
  requested_by: string;
  requested_at: string;
  approved_by?: string;
  approved_at?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'delegated';
  reason?: string;
  metadata?: Record<string, any>;
}
