// lib/revenue/initial-billing-service.ts
// Calculates initial charges. Does NOT post. Posting is handled by the workflow engine.

import { supabase } from '@/lib/supabase';
import { billingPolicyEngine, type BillingPolicy } from './billing-policy-engine';
import { financialRulesEngine } from '@/lib/financial/rules-engine';
import { publish } from '@/lib/platform/events/event-bus';
import { operationalJournal } from '@/lib/workflow/services/operational-journal';

export interface InitialCharge {
  id: string;
  charge_type: string;
  description: string;
  source: string;
  source_detail: string;
  gl_code: string;
  vat_rate: number;
  vat_treatment: string;
  amount_excl_vat: number;
  vat_amount: number;
  amount_incl_vat: number;
  selected: boolean;
}

export interface InitialBillingResult {
  leaseId: string;
  entityId: string;
  tenantName: string;
  leaseRef: string;
  propertyName: string;
  charges: InitialCharge[];
  total_excl_vat: number;
  total_incl_vat: number;
  policy: BillingPolicy;
  status: 'calculated' | 'approved' | 'posted';
}

export class InitialBillingService {
  async calculate(leaseId: string, entityId: string): Promise<InitialBillingResult> {
    const { data: lease } = await supabase
      .from('leases')
      .select('id, lease_id, tenant_id, property_id, monthly_rental, parking_bays, parking_rate, deposit_amount')
      .eq('id', leaseId)
      .single();

    if (!lease) throw new Error('Lease not found');

    const { data: tenant } = await supabase.from('tenants').select('tenant_name').eq('id', lease.tenant_id).single();
    const { data: property } = await supabase.from('properties').select('property_name').eq('id', lease.property_id).single();

    const policy = await billingPolicyEngine.resolve(leaseId);
    const charges: InitialCharge[] = [];

    // Resolve GL codes from the financial rules engine (not hardcoded)
    const rentGlCode = await financialRulesEngine.resolveAccountId(entityId, '4100');
    const parkingGlCode = await financialRulesEngine.resolveAccountId(entityId, '4200');
    const depositGlCode = await financialRulesEngine.resolveAccountId(entityId, '8100');
    const feeGlCode = await financialRulesEngine.resolveAccountId(entityId, '4400');

    // Resolve VAT from chart_of_accounts (not hardcoded)
    const vatRate = await this.getVatRate(entityId, rentGlCode || '');

    // 1. Deposit
    if (lease.deposit_amount && lease.deposit_amount > 0) {
      charges.push({
        id: crypto.randomUUID(), charge_type: 'deposit',
        description: 'Tenant Deposit',
        source: 'Lease Agreement', source_detail: 'Lease Clause — Deposit',
        gl_code: depositGlCode || '8100-001', vat_rate: 0, vat_treatment: 'non_vatable',
        amount_excl_vat: lease.deposit_amount, vat_amount: 0,
        amount_incl_vat: lease.deposit_amount, selected: true,
      });
    }

    // 2. First Month Rental
    if (lease.monthly_rental && lease.monthly_rental > 0) {
      const vat = Math.round(lease.monthly_rental * (vatRate / 100) * 100) / 100;
      charges.push({
        id: crypto.randomUUID(), charge_type: 'rent',
        description: 'First Month Rental',
        source: 'Lease Agreement', source_detail: 'Lease Clause — Rental',
        gl_code: rentGlCode || '4100-001', vat_rate: vatRate, vat_treatment: 'standard',
        amount_excl_vat: lease.monthly_rental, vat_amount: vat,
        amount_incl_vat: lease.monthly_rental + vat, selected: true,
      });
    }

    // 3. First Month Parking
    const parkingAmount = (lease.parking_bays || 0) * (lease.parking_rate || 0);
    if (parkingAmount > 0) {
      const vat = Math.round(parkingAmount * (vatRate / 100) * 100) / 100;
      charges.push({
        id: crypto.randomUUID(), charge_type: 'parking',
        description: `First Month Parking (${lease.parking_bays} bays)`,
        source: 'Lease Agreement', source_detail: 'Lease Clause — Parking',
        gl_code: parkingGlCode || '4200-001', vat_rate: vatRate, vat_treatment: 'standard',
        amount_excl_vat: parkingAmount, vat_amount: vat,
        amount_incl_vat: parkingAmount + vat, selected: true,
      });
    }

    // 4. Lease Fee (from policy)
    if (policy.lease_fee_amount > 0) {
      charges.push({
        id: crypto.randomUUID(), charge_type: 'lease_fee',
        description: policy.lease_fee_description,
        source: policy.source, source_detail: `Policy: ${policy.source} — v1`,
        gl_code: feeGlCode || '4400-001', vat_rate: 0, vat_treatment: 'non_vatable',
        amount_excl_vat: policy.lease_fee_amount, vat_amount: 0,
        amount_incl_vat: policy.lease_fee_amount, selected: true,
      });
    }

    const total_excl_vat = charges.filter(c => c.selected).reduce((s, c) => s + c.amount_excl_vat, 0);
    const total_incl_vat = charges.filter(c => c.selected).reduce((s, c) => s + c.amount_incl_vat, 0);

    const result: InitialBillingResult = {
      leaseId, entityId,
      tenantName: tenant?.tenant_name || 'Unknown',
      leaseRef: lease.lease_id,
      propertyName: property?.property_name || 'Unknown',
      charges, total_excl_vat, total_incl_vat, policy,
      status: 'calculated',
    };

    await operationalJournal.log({
      entity_id: entityId,
      reference_type: 'lease',
      reference_id: leaseId,
      event_type: 'initial_billing_calculated',
      description: `Initial billing calculated — ${charges.length} charges, R${total_incl_vat.toLocaleString()}`,
      metadata: { charges: charges.map(c => ({ type: c.charge_type, amount: c.amount_incl_vat })) },
    });

    await publish('lease.initial_billing_calculated', {
      correlationId: crypto.randomUUID(), source: 'initial-billing-service', version: '1.0', payload: result,
    });

    return result;
  }

  // Approval only — does NOT post
  async approve(billing: InitialBillingResult, actorId?: string): Promise<InitialBillingResult> {
    billing.status = 'approved';
    billing.charges = billing.charges.filter(c => c.selected);

    await operationalJournal.log({
      entity_id: billing.entityId,
      reference_type: 'lease',
      reference_id: billing.leaseId,
      event_type: 'initial_billing_approved',
      description: `Initial billing approved — ${billing.charges.length} charges, R${billing.total_incl_vat.toLocaleString()}`,
      actor_id: actorId,
      metadata: { approved_charges: billing.charges.map(c => ({ type: c.charge_type, amount: c.amount_incl_vat })) },
    });

    await publish('lease.initial_billing_approved', {
      correlationId: crypto.randomUUID(), source: 'initial-billing-service', version: '1.0', payload: billing,
    });

    return billing;
  }

  private async getVatRate(entityId: string, accountId: string): Promise<number> {
    const { data } = await supabase.from('chart_of_accounts').select('vat_rate').eq('id', accountId).single();
    return data?.vat_rate || 15;
  }
}

export const initialBillingService = new InitialBillingService();
