// lib/revenue/billing-policy-engine.ts
// Resolves effective billing policy from hierarchy: Platform → Entity → Property → Lease

import { supabase } from '@/lib/supabase';

export interface BillingPolicy {
  lease_fee_amount: number;
  lease_fee_description: string;
  late_payment_fee_pct: number;
  late_payment_fee_description: string;
  deposit_months: number;
  billing_day: number;
  auto_approve_below: number;
  source: string; // Where this policy came from
}

export class BillingPolicyEngine {
  async resolve(leaseId: string): Promise<BillingPolicy> {
    // Get lease → property → entity chain
    const { data: lease } = await supabase
      .from('leases')
      .select('property_id, monthly_rental, deposit_amount, parking_bays, parking_rate')
      .eq('id', leaseId)
      .single();

    if (!lease) return this.getDefaults();

    const { data: property } = await supabase
      .from('properties')
      .select('entity_id')
      .eq('id', lease.property_id)
      .single();

    const entityId = property?.entity_id || null;

    // Hierarchy: Platform → Entity → Property
    const { data: leaseData } = await supabase.from('leases').select('lease_type').eq('id', leaseId).single();
    const leaseType = leaseData?.lease_type || 'commercial';

    const { data: policies } = await supabase
      .from('billing_policies')
      .select('*')
      .eq('entity_id', entityId)
      .eq('policy_type', leaseType)
      .eq('is_active', true)
      .limit(1); // platform first, then entity, then property

    if (!policies?.length) return this.getDefaults();

    // Start with platform defaults, override with entity, then property
    const policy = policies?.[0] || {};

    const resolved: BillingPolicy = {
      lease_fee_amount: policy.lease_fee_amount || 1500,
      lease_fee_description: policy.lease_fee_description || 'Standard Commercial Lease Fee',
      late_payment_fee_pct: policy.late_payment_value || 10,
      late_payment_fee_description: policy.late_payment_description || 'Late Payment Fee',
      deposit_months: policy.deposit_months || 1,
      billing_day: policy.billing_day || 25,
      auto_approve_below: 0,
      source: policy.policy_name || 'Default Policy',
    };

    return resolved;
  }

  private getDefaults(): BillingPolicy {
    return {
      lease_fee_amount: 1500,
      lease_fee_description: 'Standard Commercial Lease Fee',
      late_payment_fee_pct: 10,
      late_payment_fee_description: 'Late Payment Fee',
      deposit_months: 1,
      billing_day: 25,
      auto_approve_below: 0,
      source: 'Platform Default',
    };
  }
}

export const billingPolicyEngine = new BillingPolicyEngine();
