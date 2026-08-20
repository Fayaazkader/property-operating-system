// lib/revenue/initial-billing-service.ts
// Calculates initial charges. Does NOT post. Posting is handled by the workflow engine.
// Resolves accounts via entity accounting config — no hardcoded GL/VAT

import { supabase } from '@/lib/supabase';
import { billingPolicyEngine, type BillingPolicy } from './billing-policy-engine';
import { publish } from '@/lib/platform/events/event-bus';
import { operationalJournal } from '@/lib/workflow/services/operational-journal';
import { resolveConfiguredAccount } from '@/lib/financial/accounting-resolver';

export interface InitialCharge {
  id: string;
  charge_type: string;
  description: string;
  source: string;
  source_detail: string;
  account_id: string;
  gl_code: string;
  tax_code: string;
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
      .select('id, lease_id, tenant_id, property_id, monthly_rental, parking_bays, parking_rate, deposit_amount, lease_type')
      .eq('id', leaseId)
      .single();

    if (!lease) throw new Error('Lease not found');

    const { data: tenant } = await supabase.from('tenants').select('tenant_name').eq('id', lease.tenant_id).single();
    const { data: property } = await supabase.from('properties').select('property_name').eq('id', lease.property_id).single();

    const policy = await billingPolicyEngine.resolve(leaseId);
    const charges: InitialCharge[] = [];

    // Resolve configured accounts
    const depositAccount = await resolveConfiguredAccount({
      entityId,
      businessRole: 'deposit_liability',
      taxCode: 'NO_VAT',
    });

    const rentalRole = lease.lease_type === 'residential'
      ? 'rental_income_residential'
      : 'rental_income_commercial';

    const rentAccount = await resolveConfiguredAccount({
      entityId,
      businessRole: rentalRole,
      taxCode: 'VAT_STANDARD',
    });

    const parkingAccount = await resolveConfiguredAccount({
      entityId,
      businessRole: 'recovery_utilities',
      taxCode: 'VAT_STANDARD',
    });

    const feeAccount = await resolveConfiguredAccount({
      entityId,
      businessRole: 'fee_income',
      taxCode: 'NO_VAT',
    });

    if (!depositAccount) {
      throw new Error('Deposit liability account not configured for this entity');
    }
    if (!rentAccount) {
      throw new Error(`Rental income account not configured for this entity (role: ${rentalRole})`);
    }
    if (!parkingAccount) {
      throw new Error('Recovery utilities account not configured for this entity');
    }
    if (!feeAccount) {
      throw new Error('Fee income account not configured for this entity');
    }

    // 1. Deposit
    if (lease.deposit_amount && lease.deposit_amount > 0) {
      charges.push({
        id: crypto.randomUUID(), charge_type: 'deposit',
        description: 'Tenant Deposit',
        source: 'Lease Agreement', source_detail: 'Lease Clause — Deposit',
        account_id: depositAccount.accountId, gl_code: depositAccount.glCode,
        tax_code: depositAccount.taxCode, vat_rate: depositAccount.taxRate, vat_treatment: 'no_vat',
        amount_excl_vat: lease.deposit_amount, vat_amount: 0,
        amount_incl_vat: lease.deposit_amount, selected: true,
      });
    }

    // 2. First Month Rental
    if (lease.monthly_rental && lease.monthly_rental > 0) {
      const vat = Math.round(lease.monthly_rental * (rentAccount.taxRate / 100) * 100) / 100;
      charges.push({
        id: crypto.randomUUID(), charge_type: 'rent',
        description: 'First Month Rental',
        source: 'Lease Agreement', source_detail: 'Lease Clause — Rental',
        account_id: rentAccount.accountId, gl_code: rentAccount.glCode,
        tax_code: rentAccount.taxCode, vat_rate: rentAccount.taxRate, vat_treatment: 'standard',
        amount_excl_vat: lease.monthly_rental, vat_amount: vat,
        amount_incl_vat: lease.monthly_rental + vat, selected: true,
      });
    }

    // 3. First Month Parking
    const parkingAmount = (lease.parking_bays || 0) * (lease.parking_rate || 0);
    if (parkingAmount > 0) {
      const vat = Math.round(parkingAmount * (parkingAccount.taxRate / 100) * 100) / 100;
      charges.push({
        id: crypto.randomUUID(), charge_type: 'parking',
        description: `First Month Parking (${lease.parking_bays} bays)`,
        source: 'Lease Agreement', source_detail: 'Lease Clause — Parking',
        account_id: parkingAccount.accountId, gl_code: parkingAccount.glCode,
        tax_code: parkingAccount.taxCode, vat_rate: parkingAccount.taxRate, vat_treatment: 'standard',
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
        account_id: feeAccount.accountId, gl_code: feeAccount.glCode,
        tax_code: feeAccount.taxCode, vat_rate: feeAccount.taxRate, vat_treatment: 'no_vat',
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

  async postCharges(leaseId: string, charges: InitialCharge[]): Promise<number> {
    const { data: lease } = await supabase
      .from('leases')
      .select('tenant_id, property_id, lease_start_date')
      .eq('id', leaseId)
      .single();

    if (!lease) throw new Error('Lease not found');

    const { data: property } = await supabase.from('properties').select('entity_id, owner_entity_id').eq('id', lease.property_id).single();
    const entityId = property?.entity_id || '';
    if (!entityId) throw new Error('Lease is not linked to an entity');

    const periodName = new Date(lease.lease_start_date).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });

    // IDEMPOTENCY: check existing commencement charges
    const { data: existingCharges } = await supabase
      .from('charges')
      .select('charge_type')
      .eq('lease_id', leaseId)
      .eq('source_type', 'lease_commencement')
      .eq('source_id', leaseId)
      .eq('billing_period', periodName);

    const existingTypes = new Set((existingCharges || []).map((c: any) => c.charge_type));

    let posted = 0;
    for (const charge of charges.filter(c => c.selected)) {
      if (existingTypes.has(charge.charge_type)) continue;

      const { error } = await supabase.from('charges').insert({
        lease_id: leaseId,
        tenant_id: lease.tenant_id,
        property_id: lease.property_id,
        entity_id: entityId,
        owner_entity_id: property?.owner_entity_id || entityId,
        account_id: charge.account_id,
        charge_type: charge.charge_type,
        description: charge.description + ' — ' + periodName,
        amount_excl_vat: charge.amount_excl_vat,
        vat_rate: charge.vat_rate,
        vat_amount: charge.vat_amount,
        amount_incl_vat: charge.amount_incl_vat,
        recurrence_rule: charge.charge_type === 'deposit' || charge.charge_type === 'lease_fee' ? { frequency: 'once' } : { frequency: 'monthly', period: periodName },
        recovery_method: 'fixed',
        gl_code: charge.gl_code,
        is_active: true,
        status: 'posted',
        billing_period: periodName,
        financial_period: periodName,
        source_type: 'lease_commencement',
        source_id: leaseId,
      });

      if (error) {
        throw new Error(`Failed to post ${charge.charge_type} charge: ${error.message}`);
      }
      posted++;
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