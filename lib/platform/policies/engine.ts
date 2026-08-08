// lib/platform/policies/engine.ts
// Platform Policies — Hierarchical inheritance. Entity → Portfolio → Platform Default.

import { supabase } from '@/lib/supabase';

export interface Policy {
  id: string;
  entity_id?: string;
  policy_type: string;
  category: string;
  name: string;
  description?: string;
  rules: Record<string, any>;
  is_active: boolean;
  priority: number;
}

export class PlatformPolicyEngine {

  async resolve(entityId: string, policyType: string, category: string): Promise<Record<string, any>> {
    // 1. Try entity-specific policy
    const entityPolicy = await this.getPolicy(entityId, policyType, category);
    if (entityPolicy) return entityPolicy.rules;

    // 2. Try portfolio/group policy
    const { data: entity } = await supabase
      .from('entities')
      .select('parent_entity_id')
      .eq('id', entityId)
      .single();
    
    if (entity?.parent_entity_id) {
      const portfolioPolicy = await this.getPolicy(entity.parent_entity_id, policyType, category);
      if (portfolioPolicy) return portfolioPolicy.rules;
    }

    // 3. Platform default
    return this.getPlatformDefault(policyType, category);
  }

  private async getPolicy(entityId: string, policyType: string, category: string): Promise<Policy | null> {
    const { data } = await supabase
      .from('platform_policies')
      .select('*')
      .eq('entity_id', entityId)
      .eq('policy_type', policyType)
      .eq('category', category)
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .limit(1)
      .single();

    return data as Policy | null;
  }

  private getPlatformDefault(policyType: string, category: string): Record<string, any> {
    const defaults: Record<string, Record<string, any>> = {
      revenue: {
        collections: { auto_remind: true, auto_apply_deposit: true, max_reminders: 3, legal_threshold_days: 60 },
        deposit: { auto_apply_to_arrears: true, require_top_up: true },
        reminders: { channels: ['whatsapp', 'email'], frequency_days: 3 },
        legal: { auto_generate_notice: true, cooling_off_days: 14 },
        payment_plan: { max_installments: 3, min_deposit_percent: 25 },
        discount: { max_discount_percent: 5 },
        renewal: { auto_notify_before_days: 90, max_escalation_percent: 8 },
      },
      maintenance: {
        sla: { emergency_response_hours: 4, standard_response_days: 3 },
        approvals: { auto_approve_below: 5000, require_quote_above: 20000 },
      },
      compliance: {
        inspections: { fire_interval_months: 12, lift_interval_months: 6 },
      },
    };

    return defaults[category]?.[policyType] || {};
  }
}

export const platformPolicyEngine = new PlatformPolicyEngine();
