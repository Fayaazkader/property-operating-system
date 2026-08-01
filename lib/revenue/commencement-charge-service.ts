// lib/revenue/commencement-charge-service.ts
// Handles deposit + first month charges on lease activation

import { supabase } from '@/lib/supabase';
import { publish } from '@/lib/platform/events/event-bus';

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
      .select('tenant_id, property_id, monthly_rental, parking_bays, parking_rate, deposit_amount, lease_start_date, lease_end_date')
      .eq('id', leaseId)
      .single();

    if (!lease) return { depositCreated: 0, rentalCreated: 0, parkingCreated: 0, totalCreated: 0 };

    const { data: property } = await supabase
      .from('properties')
      .select('entity_id, owner_entity_id')
      .eq('id', lease.property_id)
      .single();

    const entityId = property?.entity_id || '';
    const periodName = new Date(lease.lease_start_date).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
    let depositCreated = 0, rentalCreated = 0, parkingCreated = 0;

    // Deposit (one-time, no VAT)
    if (lease.deposit_amount && lease.deposit_amount > 0) {
      const { error } = await supabase.from('charges').insert({
        lease_id: leaseId,
        tenant_id: lease.tenant_id,
        property_id: lease.property_id,
        entity_id: entityId,
        owner_entity_id: property?.owner_entity_id || entityId,
        charge_type: 'deposit',
        description: `Tenant Deposit — ${periodName}`,
        amount_excl_vat: lease.deposit_amount,
        vat_rate: 0,
        vat_amount: 0,
        amount_incl_vat: lease.deposit_amount,
        recurrence_rule: { frequency: 'once' },
        recovery_method: 'fixed',
        gl_code: '8100-001',
        is_active: true,
        status: 'posted',
        billing_period: periodName,
        financial_period: periodName,
      });
      if (!error) depositCreated = 1;
    }

    // First month rental
    if (lease.monthly_rental && lease.monthly_rental > 0) {
      const vat = Math.round(lease.monthly_rental * 0.15 * 100) / 100;
      const { error } = await supabase.from('charges').insert({
        lease_id: leaseId,
        tenant_id: lease.tenant_id,
        property_id: lease.property_id,
        entity_id: entityId,
        owner_entity_id: property?.owner_entity_id || entityId,
        charge_type: 'rent',
        description: `Monthly Rental — ${periodName}`,
        amount_excl_vat: lease.monthly_rental,
        vat_rate: 15,
        vat_amount: vat,
        amount_incl_vat: lease.monthly_rental + vat,
        recurrence_rule: { frequency: 'monthly', period: periodName },
        recovery_method: 'fixed',
        gl_code: '4100-001',
        is_active: true,
        status: 'posted',
        billing_period: periodName,
        financial_period: periodName,
      });
      if (!error) rentalCreated = 1;
    }

    // First month parking
    const parkingAmount = (lease.parking_bays || 0) * (lease.parking_rate || 0);
    if (parkingAmount > 0) {
      const vat = Math.round(parkingAmount * 0.15 * 100) / 100;
      const { error } = await supabase.from('charges').insert({
        lease_id: leaseId,
        tenant_id: lease.tenant_id,
        property_id: lease.property_id,
        entity_id: entityId,
        owner_entity_id: property?.owner_entity_id || entityId,
        charge_type: 'parking',
        description: `Parking (${lease.parking_bays} bays × R${lease.parking_rate}) — ${periodName}`,
        amount_excl_vat: parkingAmount,
        vat_rate: 15,
        vat_amount: vat,
        amount_incl_vat: parkingAmount + vat,
        recurrence_rule: { frequency: 'monthly', period: periodName },
        recovery_method: 'fixed',
        gl_code: '4200-001',
        is_active: true,
        status: 'posted',
        billing_period: periodName,
        financial_period: periodName,
      });
      if (!error) parkingCreated = 1;
    }

    const result = { depositCreated, rentalCreated, parkingCreated, totalCreated: depositCreated + rentalCreated + parkingCreated };

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

export const commencementChargeService = new CommencementChargeService();
