// lib/platform/settings/engine.ts
// Settings Engine — Platform configuration

import { supabase } from "@/lib/supabase";
import { logger } from "../events/logger.service";
import { 
  PlatformSettings, 
  RoleConfig, 
  ApprovalPolicy, 
  FeatureFlags,
  CommunicationSettings,
  FinancialSettings,
  BrandingSettings,
  TemplateSettings
} from './types';

const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  execution_engine: true,
  conversation_platform: true,
  brokerage_operations: true,
  property_operations: true,
  disbursement_operations: true,
  portfolio_intelligence: false,
  document_intelligence: false,
  maintenance_module: true,
  mobile_app: false,
  whatsapp_chat: true,
  api_access: false,
};

const DEFAULT_COMMUNICATION: CommunicationSettings = {
  default_whatsapp: true,
  default_email: true,
  whatsapp_template_enabled: true,
  email_signature: 'AssetFlow Team',
  from_email: 'noreply@assetflow.africa',
  from_name: 'AssetFlow',
};

const DEFAULT_FINANCIAL: FinancialSettings = {
  currency: 'ZAR',
  vat_rate: 15,
  default_payment_terms: 30,
  trust_account_enabled: false,
  disbursement_approval_required: true,
};

const DEFAULT_BRANDING: BrandingSettings = {
  logo_url: '/logo.png',
  primary_color: '#34d399',
  secondary_color: '#1a1a1a',
  company_name: 'AssetFlow',
  favicon_url: '/favicon.ico',
};

const DEFAULT_TEMPLATES: TemplateSettings = {
  lease_template: 'default_lease',
  invoice_template: 'default_invoice',
  statement_template: 'default_statement',
  work_order_template: 'default_work_order',
  purchase_order_template: 'default_purchase_order',
  commission_template: 'default_commission',
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
];

export class SettingsEngine {
  private supabase = supabase;
  private cache: Map<string, PlatformSettings> = new Map();

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

  getDefaults(entityId: string): PlatformSettings {
    return {
      entity_id: entityId,
      roles: DEFAULT_ROLES,
      approval_policies: DEFAULT_APPROVAL_POLICIES,
      notification_rules: [],
      automation_rules: [],
      communication_settings: DEFAULT_COMMUNICATION,
      financial_settings: DEFAULT_FINANCIAL,
      feature_flags: DEFAULT_FEATURE_FLAGS,
      branding: DEFAULT_BRANDING,
      templates: DEFAULT_TEMPLATES,
    };
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

  async getRoles(entityId: string): Promise<RoleConfig[]> {
    const settings = await this.getSettings(entityId);
    return settings.roles;
  }

  async getApprovalPolicies(entityId: string): Promise<ApprovalPolicy[]> {
    const settings = await this.getSettings(entityId);
    return settings.approval_policies;
  }

  async getFeatureFlags(entityId: string): Promise<FeatureFlags> {
    const settings = await this.getSettings(entityId);
    return settings.feature_flags;
  }

  async isFeatureEnabled(entityId: string, feature: keyof FeatureFlags): Promise<boolean> {
    const flags = await this.getFeatureFlags(entityId);
    return flags[feature] || false;
  }
}

export const settingsEngine = new SettingsEngine();
