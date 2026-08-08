// lib/revenue-command/policies-engine.ts
// Revenue Policies — What is allowed. Playbooks define how to execute.

import { supabase } from '@/lib/supabase';

export interface RevenuePolicy {
  id: string;
  entity_id: string;
  policy_type: string;
  name: string;
  description: string;
  rules: Record<string, any>;
  is_active: boolean;
}

export class RevenuePoliciesEngine {

  async getPolicy(entityId: string, policyType: string): Promise<RevenuePolicy | null> {
    const { data } = await supabase
      .from('revenue_policies')
      .select('*')
      .eq('entity_id', entityId)
      .eq('policy_type', policyType)
      .eq('is_active', true)
      .single();

    return data as RevenuePolicy | null;
  }

  async isAllowed(entityId: string, policyType: string, action: string): Promise<boolean> {
    const policy = await this.getPolicy(entityId, policyType);
    if (!policy) return true; // No policy = allowed by default
    return policy.rules?.[action] !== false;
  }

  async getEffectivePolicy(entityId: string, policyType: string): Promise<Record<string, any>> {
    const policy = await this.getPolicy(entityId, policyType);
    return policy?.rules || this.getDefaultPolicy(policyType);
  }

  private getDefaultPolicy(policyType: string): Record<string, any> {
    const defaults: Record<string, Record<string, any>> = {
      collections: {
        auto_remind: true,
        auto_apply_deposit: true,
        max_reminders: 3,
        legal_threshold_days: 60,
        allow_payment_plans: true,
      },
      deposit: {
        auto_apply_to_arrears: true,
        require_top_up: true,
        max_application_percent: 100,
      },
      reminders: {
        channels: ['whatsapp', 'email'],
        frequency_days: 3,
        escalate_after_attempts: 2,
      },
      legal: {
        auto_generate_notice: true,
        cooling_off_days: 14,
        require_manager_approval: true,
      },
      payment_plan: {
        max_installments: 3,
        min_deposit_percent: 25,
        require_first_payment_immediate: true,
      },
      discount: {
        max_discount_percent: 5,
        require_early_payment: true,
        min_lease_term_remaining: 6,
      },
      renewal: {
        auto_notify_before_days: 90,
        offer_early_renewal: true,
        max_escalation_percent: 8,
      },
    };

    return defaults[policyType] || {};
  }
}

export const revenuePoliciesEngine = new RevenuePoliciesEngine();
