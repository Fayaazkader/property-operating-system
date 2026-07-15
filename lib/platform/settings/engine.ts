// lib/platform/settings/engine.ts
// Settings Engine — Platform configuration

import { supabase } from "@/lib/supabase";
import { logger } from "../events/logger.service";
import { 
  PlatformSettings, 
  RoleConfig, 
  ApprovalPolicy, 
  FeatureConfig,
  NotificationSettings,
  FinancialSettings,
  BrandingSettings,
  TemplateSettings,
  CommunicationSettings,
  SecuritySettings,
  AutomationSettings,
  IntegrationSettings,
  NotificationChannel,
  NotificationDefaults
} from './types';

// ============================================================
// DEFAULTS
// ============================================================

const DEFAULT_SECURITY: SecuritySettings = {
  mfa_required: false,
  session_timeout_minutes: 480,
  password_policy: {
    min_length: 8,
    require_uppercase: true,
    require_lowercase: true,
    require_numbers: true,
    require_special: false,
    expiry_days: 90,
  },
};

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  rules: [],
  channels: [
    { type: 'whatsapp', enabled: true, config: {} },
    { type: 'email', enabled: true, config: {} },
    { type: 'in_app', enabled: true, config: {} },
    { type: 'morning_brief', enabled: true, config: {} },
  ],
  defaults: {
    whatsapp: true,
    email: true,
    in_app: true,
    morning_brief: true,
  },
};

const DEFAULT_AUTOMATIONS: AutomationSettings = {
  rules: [],
  enabled: true,
};

const DEFAULT_BRANDING: BrandingSettings = {
  logo_url: '/logo.png',
  favicon_url: '/favicon.ico',
  primary_color: '#34d399',
  secondary_color: '#1a1a1a',
  accent_color: '#3b82f6',
  company_name: 'AssetFlow',
  company_tagline: 'Commercial Property Operating System',
};

const DEFAULT_FINANCIAL: FinancialSettings = {
  currency: 'ZAR',
  vat_rate: 15,
  default_payment_terms: 30,
  trust_account_enabled: false,
  disbursement_approval_required: true,
  auto_allocate_payments: false,
};

const DEFAULT_COMMUNICATIONS: CommunicationSettings = {
  default_whatsapp: true,
  default_email: true,
  whatsapp_template_enabled: true,
  email_signature: 'AssetFlow Team',
  from_email: 'noreply@assetflow.africa',
  from_name: 'AssetFlow',
};

const DEFAULT_TEMPLATES: TemplateSettings = {
  lease_template: 'default_lease',
  invoice_template: 'default_invoice',
  statement_template: 'default_statement',
  work_order_template: 'default_work_order',
  purchase_order_template: 'default_purchase_order',
  commission_template: 'default_commission',
  email_templates: {},
  whatsapp_templates: {},
};

const DEFAULT_FEATURES: FeatureConfig[] = [
  { id: 'execution_engine', name: 'Execution Engine', description: 'Agreement execution and signing', enabled: true, status: 'production' },
  { id: 'conversation_platform', name: 'Conversation Platform', description: 'WhatsApp, Search, Morning Brief', enabled: true, status: 'production' },
  { id: 'brokerage_operations', name: 'Brokerage Operations', description: 'Broker and commission management', enabled: true, status: 'production' },
  { id: 'property_operations', name: 'Property Operations', description: 'Maintenance, inspections, suppliers', enabled: true, status: 'production' },
  { id: 'disbursement_operations', name: 'Disbursement Operations', description: 'Payments and disbursements', enabled: false, status: 'development' },
  { id: 'portfolio_intelligence', name: 'Portfolio Intelligence', description: 'Analytics and forecasting', enabled: false, status: 'development' },
  { id: 'document_intelligence', name: 'Document Intelligence', description: 'OCR and document processing', enabled: false, status: 'development' },
  { id: 'mobile_app', name: 'Mobile App', description: 'Tenant and manager mobile apps', enabled: false, status: 'development' },
  { id: 'api_access', name: 'API Access', description: 'REST API and webhooks', enabled: false, status: 'development' },
];

const DEFAULT_INTEGRATIONS: IntegrationSettings = {
  twilio: { enabled: false },
  sendgrid: { enabled: false },
  banks: [],
  webhooks: [],
};

const DEFAULT_ROLES: RoleConfig[] = [
  {
    id: 'platform_admin',
    name: 'Platform Administrator',
    description: 'Full access across all entities',
    permissions: [{ resource: '*', actions: ['*'] }],
    is_custom: false,
  },
  {
    id: 'entity_admin',
    name: 'Entity Administrator',
    description: 'Full access within their entity',
    permissions: [
      { resource: 'lease', actions: ['view', 'create', 'update', 'delete', 'approve'] },
      { resource: 'tenant', actions: ['view', 'create', 'update', 'delete'] },
      { resource: 'property', actions: ['view', 'create', 'update', 'delete'] },
      { resource: 'work_order', actions: ['view', 'create', 'update', 'delete', 'assign'] },
      { resource: 'invoice', actions: ['view', 'create', 'update', 'approve'] },
      { resource: 'payment', actions: ['view', 'create', 'update', 'approve'] },
      { resource: 'supplier', actions: ['view', 'create', 'update', 'delete'] },
      { resource: 'contract', actions: ['view', 'create', 'update', 'approve'] },
      { resource: 'purchase_order', actions: ['view', 'create', 'update', 'approve'] },
      { resource: 'commission', actions: ['view', 'create', 'update', 'approve'] },
      { resource: 'user', actions: ['view', 'create', 'update'] },
      { resource: 'report', actions: ['view', 'create', 'update'] },
    ],
    is_custom: false,
  },
  {
    id: 'property_manager',
    name: 'Property Manager',
    description: 'Manage properties and maintenance',
    permissions: [
      { resource: 'lease', actions: ['view', 'create', 'update'] },
      { resource: 'tenant', actions: ['view', 'create', 'update'] },
      { resource: 'property', actions: ['view', 'create', 'update'] },
      { resource: 'work_order', actions: ['view', 'create', 'update', 'assign'] },
      { resource: 'invoice', actions: ['view'] },
      { resource: 'payment', actions: ['view'] },
      { resource: 'supplier', actions: ['view', 'create', 'update'] },
      { resource: 'contract', actions: ['view', 'create', 'update'] },
      { resource: 'asset', actions: ['view', 'create', 'update'] },
      { resource: 'inspection', actions: ['view', 'create', 'update'] },
      { resource: 'compliance', actions: ['view', 'create', 'update'] },
      { resource: 'purchase_order', actions: ['view', 'create', 'update'] },
      { resource: 'report', actions: ['view'] },
    ],
    is_custom: false,
  },
  {
    id: 'finance',
    name: 'Finance',
    description: 'Finance and billing operations',
    permissions: [
      { resource: 'lease', actions: ['view'] },
      { resource: 'invoice', actions: ['view', 'create', 'update', 'approve'] },
      { resource: 'payment', actions: ['view', 'create', 'update', 'approve'] },
      { resource: 'supplier', actions: ['view', 'create', 'update', 'delete'] },
      { resource: 'purchase_order', actions: ['view', 'create', 'update', 'approve'] },
      { resource: 'commission', actions: ['view', 'update', 'approve'] },
      { resource: 'report', actions: ['view', 'create', 'update'] },
    ],
    is_custom: false,
  },
  {
    id: 'tenant',
    name: 'Tenant',
    description: 'Tenant self-service access',
    permissions: [
      { resource: 'lease', actions: ['view'] },
      { resource: 'invoice', actions: ['view'] },
      { resource: 'payment', actions: ['view', 'create'] },
      { resource: 'work_order', actions: ['view', 'create'] },
      { resource: 'report', actions: ['view'] },
    ],
    is_custom: false,
  },
  {
    id: 'read_only',
    name: 'Read Only',
    description: 'View-only access',
    permissions: [
      { resource: 'lease', actions: ['view'] },
      { resource: 'tenant', actions: ['view'] },
      { resource: 'property', actions: ['view'] },
      { resource: 'invoice', actions: ['view'] },
      { resource: 'report', actions: ['view'] },
    ],
    is_custom: false,
  },
];

const DEFAULT_APPROVAL_POLICIES: ApprovalPolicy[] = [
  {
    id: 'approval.payment.high',
    name: 'High Value Payment Approval',
    description: 'Payments over R100,000 require CFO approval',
    entity_type: 'payment',
    action: 'approve',
    conditions: [{ field: 'amount', operator: 'gt', value: 100000 }],
    approvers: [
      { order: 1, role: 'finance_manager', type: 'role', required: true },
      { order: 2, role: 'cfo', type: 'role', required: true, timeout_hours: 48, escalation_role: 'ceo', escalation_hours: 72 },
    ],
    is_active: true,
    priority: 1,
  },
  {
    id: 'approval.lease.high',
    name: 'High Value Lease Approval',
    description: 'Leases over R200,000 per month require Director approval',
    entity_type: 'lease',
    action: 'approve',
    conditions: [{ field: 'monthly_rental', operator: 'gt', value: 200000 }],
    approvers: [
      { order: 1, role: 'property_manager', type: 'role', required: true },
      { order: 2, role: 'director', type: 'role', required: true },
    ],
    is_active: true,
    priority: 1,
  },
  {
    id: 'approval.supplier.new',
    name: 'New Supplier Approval',
    description: 'New suppliers require finance review',
    entity_type: 'supplier',
    action: 'create',
    conditions: [],
    approvers: [{ order: 1, role: 'finance', type: 'role', required: true }],
    is_active: true,
    priority: 1,
  },
];

// ============================================================
// SETTINGS ENGINE
// ============================================================

export class SettingsEngine {
  private supabase = supabase;
  private cache: Map<string, PlatformSettings> = new Map();

  getDefaults(entityId: string): PlatformSettings {
    return {
      entity_id: entityId,
      security: DEFAULT_SECURITY,
      roles: DEFAULT_ROLES,
      approval_policies: DEFAULT_APPROVAL_POLICIES,
      notifications: DEFAULT_NOTIFICATIONS,
      automations: DEFAULT_AUTOMATIONS,
      branding: DEFAULT_BRANDING,
      financial: DEFAULT_FINANCIAL,
      communications: DEFAULT_COMMUNICATIONS,
      templates: DEFAULT_TEMPLATES,
      features: DEFAULT_FEATURES,
      integrations: DEFAULT_INTEGRATIONS,
    };
  }

  async getSettings(entityId: string): Promise<PlatformSettings> {
    if (this.cache.has(entityId)) {
      return this.cache.get(entityId)!;
    }

    try {
      const { data, error } = await this.supabase
        .from('platform_settings')
        .select('*')
        .eq('entity_id', entityId)
        .single();

      if (error || !data) {
        const defaults = this.getDefaults(entityId);
        await this.createSettings(entityId, defaults);
        return defaults;
      }

      const settings = data.settings as PlatformSettings;
      this.cache.set(entityId, settings);
      return settings;
    } catch (error) {
      logger.error('Failed to get settings:', { error, entityId });
      return this.getDefaults(entityId);
    }
  }

  async createSettings(entityId: string, settings: PlatformSettings): Promise<void> {
    try {
      await this.supabase.from('platform_settings').insert({
        entity_id: entityId,
        settings: settings,
      });
      this.cache.set(entityId, settings);
    } catch (error) {
      logger.error('Failed to create settings:', { error, entityId });
    }
  }

  async updateSettings(entityId: string, updates: Partial<PlatformSettings>): Promise<void> {
    try {
      const current = await this.getSettings(entityId);
      const updated = { ...current, ...updates };
      
      await this.supabase
        .from('platform_settings')
        .update({ settings: updated })
        .eq('entity_id', entityId);
      
      this.cache.set(entityId, updated);
    } catch (error) {
      logger.error('Failed to update settings:', { error, entityId });
    }
  }

  // Domain-specific getters
  async getRoles(entityId: string): Promise<RoleConfig[]> {
    const settings = await this.getSettings(entityId);
    return settings.roles;
  }

  async getApprovalPolicies(entityId: string): Promise<ApprovalPolicy[]> {
    const settings = await this.getSettings(entityId);
    return settings.approval_policies;
  }

  async getFeatures(entityId: string): Promise<FeatureConfig[]> {
    const settings = await this.getSettings(entityId);
    return settings.features;
  }

  async isFeatureEnabled(entityId: string, featureId: string): Promise<boolean> {
    const features = await this.getFeatures(entityId);
    const feature = features.find(f => f.id === featureId);
    return feature?.enabled || false;
  }

  async getBranding(entityId: string): Promise<BrandingSettings> {
    const settings = await this.getSettings(entityId);
    return settings.branding;
  }

  async getFinancialSettings(entityId: string): Promise<FinancialSettings> {
    const settings = await this.getSettings(entityId);
    return settings.financial;
  }

  async getCommunicationSettings(entityId: string): Promise<CommunicationSettings> {
    const settings = await this.getSettings(entityId);
    return settings.communications;
  }

  async getTemplates(entityId: string): Promise<TemplateSettings> {
    const settings = await this.getSettings(entityId);
    return settings.templates;
  }

  async getNotificationSettings(entityId: string): Promise<NotificationSettings> {
    const settings = await this.getSettings(entityId);
    return settings.notifications;
  }

  async getAutomationSettings(entityId: string): Promise<AutomationSettings> {
    const settings = await this.getSettings(entityId);
    return settings.automations;
  }

  async getSecuritySettings(entityId: string): Promise<SecuritySettings> {
    const settings = await this.getSettings(entityId);
    return settings.security;
  }

  async getIntegrations(entityId: string): Promise<IntegrationSettings> {
    const settings = await this.getSettings(entityId);
    return settings.integrations;
  }

  // Role management
  async addRole(entityId: string, role: RoleConfig): Promise<void> {
    const settings = await this.getSettings(entityId);
    settings.roles.push({ ...role, is_custom: true });
    await this.updateSettings(entityId, { roles: settings.roles });
  }

  async updateRole(entityId: string, roleId: string, updates: Partial<RoleConfig>): Promise<void> {
    const settings = await this.getSettings(entityId);
    const index = settings.roles.findIndex(r => r.id === roleId);
    if (index === -1) return;
    settings.roles[index] = { ...settings.roles[index], ...updates };
    await this.updateSettings(entityId, { roles: settings.roles });
  }

  // Approval policy management
  async addApprovalPolicy(entityId: string, policy: ApprovalPolicy): Promise<void> {
    const settings = await this.getSettings(entityId);
    settings.approval_policies.push(policy);
    await this.updateSettings(entityId, { approval_policies: settings.approval_policies });
  }

  async updateApprovalPolicy(entityId: string, policyId: string, updates: Partial<ApprovalPolicy>): Promise<void> {
    const settings = await this.getSettings(entityId);
    const index = settings.approval_policies.findIndex(p => p.id === policyId);
    if (index === -1) return;
    settings.approval_policies[index] = { ...settings.approval_policies[index], ...updates };
    await this.updateSettings(entityId, { approval_policies: settings.approval_policies });
  }

  // Feature management
  async updateFeature(entityId: string, featureId: string, updates: Partial<FeatureConfig>): Promise<void> {
    const settings = await this.getSettings(entityId);
    const index = settings.features.findIndex(f => f.id === featureId);
    if (index === -1) return;
    settings.features[index] = { ...settings.features[index], ...updates };
    await this.updateSettings(entityId, { features: settings.features });
  }
}

export const settingsEngine = new SettingsEngine();
