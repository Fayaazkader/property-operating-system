// lib/platform/settings/types.ts
// Platform Settings Type Definitions — Split by Domain

export interface PlatformSettings {
  entity_id: string;
  security: SecuritySettings;
  roles: RoleConfig[];
  approval_policies: ApprovalPolicy[];
  notifications: NotificationSettings;
  automations: AutomationSettings;
  branding: BrandingSettings;
  financial: FinancialSettings;
  communications: CommunicationSettings;
  templates: TemplateSettings;
  features: FeatureConfig[];
  integrations: IntegrationSettings;
}

// ============================================================
// SECURITY
// ============================================================

export interface SecuritySettings {
  mfa_required: boolean;
  session_timeout_minutes: number;
  password_policy: PasswordPolicy;
  ip_whitelist?: string[];
}

export interface PasswordPolicy {
  min_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_numbers: boolean;
  require_special: boolean;
  expiry_days: number;
}

// ============================================================
// ROLES
// ============================================================

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

// ============================================================
// APPROVAL POLICIES
// ============================================================

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
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in' | 'startsWith' | 'endsWith';
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

// ============================================================
// NOTIFICATIONS
// ============================================================

export interface NotificationSettings {
  rules: NotificationRule[];
  channels: NotificationChannel[];
  defaults: NotificationDefaults;
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

export interface NotificationChannel {
  type: 'whatsapp' | 'email' | 'push' | 'in_app' | 'morning_brief' | 'daily_digest' | 'webhook';
  enabled: boolean;
  config: Record<string, any>;
}

export interface NotificationDefaults {
  whatsapp: boolean;
  email: boolean;
  in_app: boolean;
  morning_brief: boolean;
}

// ============================================================
// AUTOMATIONS
// ============================================================

export interface AutomationSettings {
  rules: AutomationRule[];
  enabled: boolean;
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
  type: 'publish_event' | 'create_task' | 'send_notification' | 'update_field' | 'execute_workflow' | 'create_work_order' | 'send_reminder';
  target: string;
  config: Record<string, any>;
}

// ============================================================
// BRANDING
// ============================================================

export interface BrandingSettings {
  logo_url: string;
  favicon_url: string;
  primary_color: string;
  secondary_color: string;
  accent_color?: string;
  company_name: string;
  company_tagline?: string;
}

// ============================================================
// FINANCIAL
// ============================================================

export interface FinancialSettings {
  currency: string;
  vat_rate: number;
  default_payment_terms: number;
  trust_account_enabled: boolean;
  disbursement_approval_required: boolean;
  auto_allocate_payments: boolean;
}

// ============================================================
// COMMUNICATIONS
// ============================================================

export interface CommunicationSettings {
  default_whatsapp: boolean;
  default_email: boolean;
  whatsapp_template_enabled: boolean;
  email_signature: string;
  from_email: string;
  from_name: string;
  allowed_domains?: string[];
}

// ============================================================
// TEMPLATES
// ============================================================

export interface TemplateSettings {
  lease_template: string;
  invoice_template: string;
  statement_template: string;
  work_order_template: string;
  purchase_order_template: string;
  commission_template: string;
  email_templates: Record<string, string>;
  whatsapp_templates: Record<string, string>;
}

// ============================================================
// FEATURES (with rollout support)
// ============================================================

export interface FeatureConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rollout_percentage?: number;
  min_plan?: string;
  requires?: string[];
  beta?: boolean;
  dependencies?: string[];
  status: 'development' | 'beta' | 'production' | 'deprecated';
}

// ============================================================
// INTEGRATIONS
// ============================================================

export interface IntegrationSettings {
  twilio: TwilioConfig;
  sendgrid: SendGridConfig;
  banks: BankConfig[];
  webhooks: WebhookConfig[];
}

export interface TwilioConfig {
  enabled: boolean;
  account_sid?: string;
  auth_token?: string;
  whatsapp_number?: string;
}

export interface SendGridConfig {
  enabled: boolean;
  api_key?: string;
  from_email?: string;
  from_name?: string;
}

export interface BankConfig {
  id: string;
  name: string;
  enabled: boolean;
  integration_type: 'api' | 'file' | 'manual';
  config: Record<string, any>;
}

export interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  secret: string;
  enabled: boolean;
}
