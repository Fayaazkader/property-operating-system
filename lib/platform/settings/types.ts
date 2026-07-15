// lib/platform/settings/types.ts
// Platform Settings Type Definitions

export interface PlatformSettings {
  entity_id: string;
  roles: RoleConfig[];
  approval_policies: ApprovalPolicy[];
  notification_rules: NotificationRule[];
  automation_rules: AutomationRule[];
  communication_settings: CommunicationSettings;
  financial_settings: FinancialSettings;
  feature_flags: FeatureFlags;
  branding: BrandingSettings;
  templates: TemplateSettings;
}

export interface RoleConfig {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  is_custom: boolean;
  base_role?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Permission {
  resource: string;
  actions: string[];
}

export interface ApprovalPolicy {
  id: string;
  name: string;
  description: string;
  entity_type: string;
  action: string;
  conditions: ApprovalCondition[];
  approvers: ApprovalStep[];
  is_active: boolean;
  priority: number;
  created_at?: string;
  updated_at?: string;
}

export interface ApprovalCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';
  value: any;
}

export interface ApprovalStep {
  order: number;
  role: string;
  type: 'role' | 'user' | 'group' | 'dynamic';
  required: boolean;
  timeout_hours?: number;
  escalation_role?: string;
  escalation_hours?: number;
}

export interface NotificationRule {
  id: string;
  name: string;
  event: string;
  channels: string[];
  recipients: string[];
  template: string;
  conditions?: NotificationCondition[];
  is_active: boolean;
}

export interface NotificationCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains';
  value: any;
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: string;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  is_active: boolean;
  priority: number;
}

export interface AutomationCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'changed_to' | 'changed_from';
  value: any;
}

export interface AutomationAction {
  type: 'publish_event' | 'create_task' | 'send_notification' | 'update_field' | 'execute_workflow';
  target: string;
  config: Record<string, any>;
}

export interface CommunicationSettings {
  default_whatsapp: boolean;
  default_email: boolean;
  whatsapp_template_enabled: boolean;
  email_signature: string;
  from_email: string;
  from_name: string;
}

export interface FinancialSettings {
  currency: string;
  vat_rate: number;
  default_payment_terms: number;
  trust_account_enabled: boolean;
  disbursement_approval_required: boolean;
}

export interface FeatureFlags {
  execution_engine: boolean;
  conversation_platform: boolean;
  brokerage_operations: boolean;
  property_operations: boolean;
  disbursement_operations: boolean;
  portfolio_intelligence: boolean;
  document_intelligence: boolean;
  maintenance_module: boolean;
  mobile_app: boolean;
  whatsapp_chat: boolean;
  api_access: boolean;
}

export interface BrandingSettings {
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  company_name: string;
  favicon_url: string;
}

export interface TemplateSettings {
  lease_template: string;
  invoice_template: string;
  statement_template: string;
  work_order_template: string;
  purchase_order_template: string;
  commission_template: string;
}
