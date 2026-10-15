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
    const {data:lease,error:leaseError}=await supabase.from('leases').select('property_id').eq('id',leaseId).single();
    if(leaseError||!lease)throw new Error('Lease unavailable for policy review');
    const {data:property,error:propertyError}=await supabase.from('properties').select('entity_id').eq('id',lease.property_id).single();
    if(propertyError||!property?.entity_id)throw new Error('Policy entity unavailable');
    const {data,error}=await supabase.rpc('prepare_lease_commencement_billing',{p_entity_id:property.entity_id,p_lease_id:leaseId});
    if(error||!data?.policy)throw new Error(error?.message||'Canonical policy review unavailable');
    return data.policy as BillingPolicy;
  }
}
export const billingPolicyEngine = new BillingPolicyEngine();
