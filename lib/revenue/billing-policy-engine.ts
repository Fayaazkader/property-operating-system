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
    const { data: policies } = await supabase
      .from('billing_policies')
      .select('*')
      .or(`scope.eq.platform,entity_id.eq.${entityId},property_id.eq.${lease.property_id}`)
      .eq('is_active', true)
      .order('scope', { ascending: true }); // platform first, then entity, then property

    if (!policies?.length) return this.getDefaults();

    // Start with platform defaults, override with entity, then property
    const platform = policies.find(p => p.scope === 'platform') || {};
    const entity = policies.find(p => p.scope === 'entity') || {};
    const property = policies.find(p => p.scope === 'property') || {};

    const resolved: BillingPolicy = {
      lease_fee_amount: property.lease_fee_amount || entity.lease_fee_amount || platform.lease_fee_amount || 1500,
      lease_fee_description: property.lease_fee_description || entity.lease_fee_description || platform.lease_fee_description || 'Standard Commercial Lease Fee',
      late_payment_fee_pct: property.late_payment_fee_pct || entity.late_payment_fee_pct || platform.late_payment_fee_pct || 10,
      late_payment_fee_description: property.late_payment_fee_description || entity.late_payment_fee_description || platform.late_payment_fee_description || 'Late Payment Fee',
      deposit_months: property.deposit_months || entity.deposit_months || platform.deposit_months || 1,
      billing_day: property.billing_day || entity.billing_day || platform.billing_day || 25,
      auto_approve_below: property.auto_approve_below || entity.auto_approve_below || platform.auto_approve_below || 0,
      source: property.id ? 'Property Policy' : entity.id ? 'Entity Policy' : 'Platform Default',
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
