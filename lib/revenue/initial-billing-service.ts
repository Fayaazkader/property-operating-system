// lib/revenue/initial-billing-service.ts
// Calculates initial charges when a lease is activated

import { supabase } from '@/lib/supabase';
import { billingPolicyEngine, type BillingPolicy } from './billing-policy-engine';
import { publish } from '@/lib/platform/events/event-bus';

export interface InitialCharge {
  id: string;
  charge_type: string;
  description: string;
  source: string;
  amount_excl_vat: number;
  vat_rate: number;
  vat_amount: number;
  amount_incl_vat: number;
  selected: boolean;
  editable: boolean;
}

export interface InitialBillingResult {
  leaseId: string;
  tenantName: string;
  leaseRef: string;
  propertyName: string;
  charges: InitialCharge[];
  total_excl_vat: number;
  total_incl_vat: number;
  policy: BillingPolicy;
}

export class InitialBillingService {
  async calculate(leaseId: string): Promise<InitialBillingResult> {
    const { data: lease } = await supabase
      .from('leases')
      .select('id, lease_id, tenant_id, property_id, unit_id, monthly_rental, parking_bays, parking_rate, deposit_amount')
      .eq('id', leaseId)
      .single();

    if (!lease) throw new Error('Lease not found');

    const { data: tenant } = await supabase.from('tenants').select('tenant_name').eq('id', lease.tenant_id).single();
    const { data: property } = await supabase.from('properties').select('property_name').eq('id', lease.property_id).single();

    const policy = await billingPolicyEngine.resolve(leaseId);
    const charges: InitialCharge[] = [];

    // 1. Deposit (from lease, not policy)
    if (lease.deposit_amount && lease.deposit_amount > 0) {
      charges.push({
        id: crypto.randomUUID(),
        charge_type: 'deposit',
        description: 'Tenant Deposit',
        source: 'Lease Agreement',
        amount_excl_vat: lease.deposit_amount,
        vat_rate: 0,
        vat_amount: 0,
        amount_incl_vat: lease.deposit_amount,
        selected: true,
        editable: true,
      });
    }

    // 2. First Month Rental (from lease)
    if (lease.monthly_rental && lease.monthly_rental > 0) {
      const vat = Math.round(lease.monthly_rental * 0.15 * 100) / 100;
      charges.push({
        id: crypto.randomUUID(),
        charge_type: 'rent',
        description: 'First Month Rental',
        source: 'Lease Agreement',
        amount_excl_vat: lease.monthly_rental,
        vat_rate: 15,
        vat_amount: vat,
        amount_incl_vat: lease.monthly_rental + vat,
        selected: true,
        editable: true,
      });
    }

    // 3. First Month Parking (from lease)
    const parkingAmount = (lease.parking_bays || 0) * (lease.parking_rate || 0);
    if (parkingAmount > 0) {
      const vat = Math.round(parkingAmount * 0.15 * 100) / 100;
      charges.push({
        id: crypto.randomUUID(),
        charge_type: 'parking',
        description: `First Month Parking (${lease.parking_bays} bays)`,
        source: 'Lease Agreement',
        amount_excl_vat: parkingAmount,
        vat_rate: 15,
        vat_amount: vat,
        amount_incl_vat: parkingAmount + vat,
        selected: true,
        editable: true,
      });
    }

    // 4. Lease Fee (from policy)
    if (policy.lease_fee_amount > 0) {
      charges.push({
        id: crypto.randomUUID(),
        charge_type: 'lease_fee',
        description: policy.lease_fee_description,
        source: policy.source,
        amount_excl_vat: policy.lease_fee_amount,
        vat_rate: 0,
        vat_amount: 0,
        amount_incl_vat: policy.lease_fee_amount,
        selected: true,
        editable: true,
      });
    }

    const total_excl_vat = charges.filter(c => c.selected).reduce((s, c) => s + c.amount_excl_vat, 0);
    const total_incl_vat = charges.filter(c => c.selected).reduce((s, c) => s + c.amount_incl_vat, 0);

    const result: InitialBillingResult = {
      leaseId,
      tenantName: tenant?.tenant_name || 'Unknown',
      leaseRef: lease.lease_id,
      propertyName: property?.property_name || 'Unknown',
      charges,
      total_excl_vat,
      total_incl_vat,
      policy,
    };

    await publish('lease.initial_billing_calculated', {
      correlationId: crypto.randomUUID(),
      source: 'initial-billing-service',
      version: '1.0',
      payload: result,
    });

    return result;
  }

  async postCharges(leaseId: string, charges: InitialCharge[]): Promise<number> {
    const { data: lease } = await supabase
      .from('leases')
      .select('tenant_id, property_id, lease_start_date')
      .eq('id', leaseId)
      .single();

    if (!lease) return 0;

    const { data: property } = await supabase.from('properties').select('entity_id, owner_entity_id').eq('id', lease.property_id).single();
    const entityId = property?.entity_id || '';
    const periodName = new Date(lease.lease_start_date).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });

    let posted = 0;
    for (const charge of charges.filter(c => c.selected)) {
      const { error } = await supabase.from('charges').insert({
        lease_id: leaseId,
        tenant_id: lease.tenant_id,
        property_id: lease.property_id,
        entity_id: entityId,
        owner_entity_id: property?.owner_entity_id || entityId,
        charge_type: charge.charge_type,
        description: `${charge.description} — ${periodName}`,
        amount_excl_vat: charge.amount_excl_vat,
        vat_rate: charge.vat_rate,
        vat_amount: charge.vat_amount,
        amount_incl_vat: charge.amount_incl_vat,
        recurrence_rule: charge.charge_type === 'deposit' || charge.charge_type === 'lease_fee' ? { frequency: 'once' } : { frequency: 'monthly', period: periodName },
        recovery_method: 'fixed',
        gl_code: charge.charge_type === 'rent' ? '4100-001' : charge.charge_type === 'parking' ? '4200-001' : charge.charge_type === 'deposit' ? '8100-001' : '4400-001',
        is_active: true,
        status: 'posted',
        billing_period: periodName,
        financial_period: periodName,
      });
      if (!error) posted++;
    }

    if (posted > 0) {
      await publish('lease.initial_charges_posted', {
        correlationId: crypto.randomUUID(),
        source: 'initial-billing-service',
        version: '1.0',
        payload: { leaseId, chargesPosted: posted },
      });
    }

    return posted;
  }
}

export const initialBillingService = new InitialBillingService();
