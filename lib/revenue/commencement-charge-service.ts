// lib/revenue/commencement-charge-service.ts
// Handles deposit + first month charges on lease activation
// Resolves accounts via entity accounting config — no hardcoded GL/VAT

import { supabase } from '@/lib/supabase';
import { publish } from '@/lib/platform/events/event-bus';
import { resolveConfiguredAccount } from '@/lib/financial/accounting-resolver';

export interface CommencementCharges {
  depositCreated: number;
  rentalCreated: number;
  parkingCreated: number;
  totalCreated: number;
}

export class CommencementChargeService {
  async generate(leaseId: string): Promise<CommencementCharges> {
    const { data: lease } = await supabase
      .from('leases')
      .select('tenant_id, property_id, monthly_rental, parking_bays, parking_rate, deposit_amount, lease_start_date, lease_end_date, lease_type')
      .eq('id', leaseId)
      .single();

    if (!lease) {
      throw new Error('Lease not found');
    }

    const { data: property } = await supabase
      .from('properties')
      .select('entity_id, owner_entity_id')
      .eq('id', lease.property_id)
      .single();

    const entityId = property?.entity_id || '';
    if (!entityId) {
      throw new Error('Lease is not linked to an entity — cannot generate charges');
    }

    // Resolve configured accounts
    const depositAccount = await resolveConfiguredAccount({
      entityId,
      businessRole: 'deposit_liability',
      taxCode: 'NO_VAT',
    });

    const rentalRole = lease.lease_type === 'residential'
      ? 'rental_income_residential'
      : 'rental_income_commercial';

    const rentalAccount = await resolveConfiguredAccount({
      entityId,
      businessRole: rentalRole,
      taxCode: 'VAT_STANDARD',
    });

    const parkingAccount = await resolveConfiguredAccount({
      entityId,
      businessRole: 'recovery_utilities',
      taxCode: 'VAT_STANDARD',
    });

    if (!depositAccount) {
      throw new Error('Deposit liability account not configured for this entity');
    }
    if (!rentalAccount) {
      throw new Error(`Rental income account not configured for this entity (role: ${rentalRole})`);
    }
    if (!parkingAccount) {
      throw new Error('Recovery utilities account not configured for this entity');
    }

    const periodName = new Date(lease.lease_start_date).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });

    // IDEMPOTENCY: check existing commencement charges for this lease/period
    const { data: existingCharges } = await supabase
      .from('charges')
      .select('charge_type')
      .eq('lease_id', leaseId)
      .eq('source_type', 'lease_commencement')
      .eq('source_id', leaseId)
      .eq('billing_period', periodName);

    const existingTypes = new Set((existingCharges || []).map((c: any) => c.charge_type));

    let depositCreated = 0, rentalCreated = 0, parkingCreated = 0;

    // Deposit (liability, no VAT)
    if (lease.deposit_amount && lease.deposit_amount > 0 && !existingTypes.has('deposit')) {
      const { error } = await supabase.from('charges').insert({
        lease_id: leaseId,
        tenant_id: lease.tenant_id,
        property_id: lease.property_id,
        entity_id: entityId,
        owner_entity_id: property?.owner_entity_id || entityId,
        account_id: depositAccount.accountId,
        charge_type: 'deposit',
        description: `Tenant Deposit — ${periodName}`,
        amount_excl_vat: lease.deposit_amount,
        vat_rate: depositAccount.taxRate,
        vat_amount: 0,
        amount_incl_vat: lease.deposit_amount,
        recurrence_rule: { frequency: 'once' },
        recovery_method: 'fixed',
        gl_code: depositAccount.glCode,
        is_active: true,
        status: 'posted',
        billing_period: periodName,
        financial_period: periodName,
        source_type: 'lease_commencement',
        source_id: leaseId,
      });

      if (error) {
        throw new Error(`Failed to create deposit charge: ${error.message}`);
      }
      depositCreated = 1;
    }

    // First month rental
    if (lease.monthly_rental && lease.monthly_rental > 0 && !existingTypes.has('rent')) {
      const vatAmount = Math.round(lease.monthly_rental * (rentalAccount.taxRate / 100) * 100) / 100;
      const { error } = await supabase.from('charges').insert({
        lease_id: leaseId,
        tenant_id: lease.tenant_id,
        property_id: lease.property_id,
        entity_id: entityId,
        owner_entity_id: property?.owner_entity_id || entityId,
        account_id: rentalAccount.accountId,
        charge_type: 'rent',
        description: `Monthly Rental — ${periodName}`,
        amount_excl_vat: lease.monthly_rental,
        vat_rate: rentalAccount.taxRate,
        vat_amount: vatAmount,
        amount_incl_vat: lease.monthly_rental + vatAmount,
        recurrence_rule: { frequency: 'monthly', period: periodName },
        recovery_method: 'fixed',
        gl_code: rentalAccount.glCode,
        is_active: true,
        status: 'posted',
        billing_period: periodName,
        financial_period: periodName,
        source_type: 'lease_commencement',
        source_id: leaseId,
      });

      if (error) {
        throw new Error(`Failed to create rental charge: ${error.message}`);
      }
      rentalCreated = 1;
    }

    // First month parking
    const parkingAmount = (lease.parking_bays || 0) * (lease.parking_rate || 0);
    if (parkingAmount > 0 && !existingTypes.has('parking')) {
      const vatAmount = Math.round(parkingAmount * (parkingAccount.taxRate / 100) * 100) / 100;
      const { error } = await supabase.from('charges').insert({
        lease_id: leaseId,
        tenant_id: lease.tenant_id,
        property_id: lease.property_id,
        entity_id: entityId,
        owner_entity_id: property?.owner_entity_id || entityId,
        account_id: parkingAccount.accountId,
        charge_type: 'parking',
        description: `Parking (${lease.parking_bays} bays × R${lease.parking_rate}) — ${periodName}`,
        amount_excl_vat: parkingAmount,
        vat_rate: parkingAccount.taxRate,
        vat_amount: vatAmount,
        amount_incl_vat: parkingAmount + vatAmount,
        recurrence_rule: { frequency: 'monthly', period: periodName },
        recovery_method: 'fixed',
        gl_code: parkingAccount.glCode,
        is_active: true,
        status: 'posted',
        billing_period: periodName,
        financial_period: periodName,
        source_type: 'lease_commencement',
        source_id: leaseId,
      });

      if (error) {
        throw new Error(`Failed to create parking charge: ${error.message}`);
      }
      parkingCreated = 1;
    }

    const result = {
      depositCreated,
      rentalCreated,
      parkingCreated,
      totalCreated: depositCreated + rentalCreated + parkingCreated,
    };

    if (result.totalCreated > 0) {
      await publish('lease.commencement_charges_created', {
        correlationId: crypto.randomUUID(),
        source: 'commencement-charge-service',
        version: '1.0',
        payload: { leaseId, ...result },
      });
    }

    return result;
  }
}

