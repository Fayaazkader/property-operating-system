// lib/platform/admin/types.ts
// Platform Administration Types v2

export type FeatureFlagScope = 'global' | 'entity' | 'user';
export type PolicyEffect = 'require_approval' | 'auto_assign' | 'warn' | 'block' | 'notify' | 'allow';
export type PolicyCategory = 'financial' | 'brokerage' | 'operations' | 'leasing' | 'compliance' | 'admin';
export type TeamCategory = 'finance' | 'leasing' | 'operations' | 'executive' | 'facilities' | 'custom';
export type PermissionCategory = 'financial' | 'procurement' | 'leasing' | 'operations' | 'brokerage' | 'reporting' | 'admin';

export interface Permission {
  id: string;
  permission_key: string;
  name: string;
  description?: string;
  category: PermissionCategory;
}

export interface Role {
  id: string;
  entity_id: string;
  name: string;
  description?: string;
  role_permissions: string[];
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface FeatureFlag {
  id: string;
  entity_id?: string;
  flag_permission_key: string;
  flag_name: string;
  description?: string;
  enabled: boolean;
  rollout_percentage: number;
  target_roles?: string[];
  target_user_ids?: string[];
  scope: FeatureFlagScope;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  entity_id: string;
  name: string;
  description?: string;
  category?: TeamCategory;
  purpose?: string;
  lead_id?: string;
  is_assignable: boolean;
  member_count?: number;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  joined_at: string;
}

export interface Invitation {
  id: string;
  entity_id: string;
  email: string;
  role: string;
  team_ids?: string[];
  invited_by?: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expires_at: string;
  accepted_at?: string;
  created_at: string;
}

export interface OperationalPolicy {
  id: string;
  entity_id: string;
  name: string;
  description?: string;
  category: PolicyCategory;
  resource: string;
  action: string;
  conditions: PolicyCondition[];
  effect: PolicyEffect;
  effect_config: Record<string, any>;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PolicyCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in';
  value: any;
}

export interface UserEntityAccess {
  id: string;
  user_id: string;
  entity_id: string;
  role: string;
  assigned_by?: string;
  assigned_at: string;
}

export interface EntityHealth {
  entity_id: string;
  name: string;
  user_count: number;
  team_count: number;
  active_automations: number;
  pending_approvals: number;
  active_features: string[];
  integrations: {
    whatsapp: 'connected' | 'disconnected';
    email: 'connected' | 'disconnected';
    bank: 'connected' | 'disconnected';
  };
  storage_used_mb: number;
  security_score: number;
  api_keys_count: number;
}

export interface InviteUserParams {
  email: string;
  entity_id: string;
  role: string;
  team_ids?: string[];
  invited_by?: string;
}

export interface UpdateAccessParams {
  user_id: string;
  entity_id: string;
  role: string;
}

export interface CreateTeamParams {
  entity_id: string;
  name: string;
  description?: string;
  category?: TeamCategory;
  purpose?: string;
  lead_id?: string;
}

export interface CreatePolicyParams {
  entity_id: string;
  name: string;
  description?: string;
  category: PolicyCategory;
  resource: string;
  action: string;
  conditions: PolicyCondition[];
  effect: PolicyEffect;
  effect_config?: Record<string, any>;
  priority?: number;
}
