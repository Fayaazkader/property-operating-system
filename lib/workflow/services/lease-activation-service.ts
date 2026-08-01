import { supabase } from '@/lib/supabase';
import { extractRulesFromLease } from '@/lib/revenue/rule-extractor';
import { generateChargesFromRules } from '@/lib/revenue/charge-generator';
import { publish } from '@/lib/platform/events/event-bus';
import type { ActivationResult, ActivateLeaseRpcResult } from '@/lib/workflow/domain/activation-context';

export interface ActivationInput {
  entityId: string;
  tenantName: string;
  companyRegistration?: string;
  vatNumber?: string;
  email?: string;
  phone?: string;
  propertyId: string;
  unitId: string;
  monthlyRental: number;
  leaseStartDate: string;
  leaseEndDate: string;
  escalationPercent: number;
  depositAmount: number;
  parkingBays: number;
  parkingRate: number;
  selectedBillableItems?: string[];
  documentFile?: { name: string; url: string };
}

export class LeaseActivationService {
  async execute(input: ActivationInput): Promise<ActivationResult> {
    const startedAt = Date.now();

    // Phase 1: Atomic tenant + lease via PostgreSQL RPC
    const { data: rpcResult, error: rpcError } = await supabase.rpc('activate_lease', {
      p_entity_id: input.entityId,
      p_tenant_name: input.tenantName,
      p_company_registration: input.companyRegistration || null,
      p_vat_number: input.vatNumber || null,
      p_email: input.email || null,
      p_phone: input.phone || null,
      p_property_id: input.propertyId,
      p_unit_id: input.unitId,
      p_monthly_rental: input.monthlyRental,
      p_lease_start_date: input.leaseStartDate,
      p_lease_end_date: input.leaseEndDate,
      p_escalation_percent: input.escalationPercent,
      p_deposit_amount: input.depositAmount,
      p_parking_bays: input.parkingBays,
      p_parking_rate: input.parkingRate,
      p_document_name: input.documentFile?.name || null,
      p_document_url: input.documentFile?.url || null,
    });

    if (rpcError) throw rpcError;
    
    const result = rpcResult as unknown as ActivateLeaseRpcResult;
    if (!result?.tenant_id) throw new Error('Activation RPC returned no data');

    // Phase 2: Extract billing rules (always — rules must exist immediately)
    const rulesCreated = await extractRulesFromLease(result.lease_id);

    // Phase 3: Auto-bill deposit + first month rental immediately
    // These are one-time charges that happen on activation, not waiting for period close
    const depositCreated = await this.createDepositCharge(result.lease_id, input);
    const firstMonthCreated = await this.createFirstMonthCharge(result.lease_id, input);

    // Phase 4: Publish event
    await publish('lease.activated', {
      correlationId: crypto.randomUUID(),
      source: 'lease-activation-service',
      version: '1.0',
      payload: {
        tenantId: result.tenant_id,
        leaseId: result.lease_id,
        leaseRef: result.lease_ref,
        entityId: input.entityId,
      },
    });

    const duration = Date.now() - startedAt;

    return {
      tenantId: result.tenant_id,
      leaseId: result.lease_id,
      tenantCode: result.tenant_code,
      leaseRef: result.lease_ref,
      rulesCreated,
      chargesGenerated: depositCreated + firstMonthCreated,
      documentsAttached: result.documents_attached || 0,
      contactsCreated: result.contacts_created || 0,
      warnings: 0,
      duration,
      events: ['tenant_created', 'lease_created', 'billing_rules_extracted', 'deposit_charged', 'first_month_charged', 'event_published'],
    };
  }

  private async createDepositCharge(leaseId: string, input: ActivationInput): Promise<number> {
    if (!input.depositAmount || input.depositAmount <= 0) return 0;
    
    const { data: lease } = await supabase.from('leases').select('tenant_id, property_id').eq('id', leaseId).single();
    if (!lease) return 0;

    const { data: property } = await supabase.from('properties').select('entity_id, owner_entity_id').eq('id', lease.property_id).single();
    const entityId = property?.entity_id || input.entityId;

    const { error } = await supabase.from('charges').insert({
      lease_id: leaseId,
      tenant_id: lease.tenant_id,
      property_id: lease.property_id,
      entity_id: entityId,
      owner_entity_id: property?.owner_entity_id || entityId,
      charge_type: 'deposit',
      description: `Tenant Deposit — ${new Date(input.leaseStartDate).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}`,
      amount_excl_vat: input.depositAmount,
      vat_rate: 0,
      vat_amount: 0,
      amount_incl_vat: input.depositAmount,
      recurrence_rule: { frequency: 'once', period: 'once' },
      recovery_method: 'fixed',
      gl_code: '8100-001',
      is_active: true,
      status: 'posted',
      billing_period: new Date(input.leaseStartDate).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' }),
      financial_period: new Date(input.leaseStartDate).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' }),
    });

    return error ? 0 : 1;
  }

  private async createFirstMonthCharge(leaseId: string, input: ActivationInput): Promise<number> {
    const { data: lease } = await supabase.from('leases').select('tenant_id, property_id, parking_bays, parking_rate').eq('id', leaseId).single();
    if (!lease) return 0;

    const { data: property } = await supabase.from('properties').select('entity_id, owner_entity_id').eq('id', lease.property_id).single();
    const entityId = property?.entity_id || input.entityId;
    const periodName = new Date(input.leaseStartDate).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
    let created = 0;

    // First month rental
    const rentalVat = Math.round(input.monthlyRental * 0.15 * 100) / 100;
    const { error: rentError } = await supabase.from('charges').insert({
      lease_id: leaseId,
      tenant_id: lease.tenant_id,
      property_id: lease.property_id,
      entity_id: entityId,
      owner_entity_id: property?.owner_entity_id || entityId,
      charge_type: 'rent',
      description: `Monthly Rental — ${periodName}`,
      amount_excl_vat: input.monthlyRental,
      vat_rate: 15,
      vat_amount: rentalVat,
      amount_incl_vat: input.monthlyRental + rentalVat,
      recurrence_rule: { frequency: 'monthly', period: periodName },
      recovery_method: 'fixed',
      gl_code: '4100-001',
      is_active: true,
      status: 'posted',
      billing_period: periodName,
      financial_period: periodName,
    });
    if (!rentError) created++;

    // First month parking
    const parkingAmount = (input.parkingBays || 0) * (input.parkingRate || 0);
    if (parkingAmount > 0) {
      const parkingVat = Math.round(parkingAmount * 0.15 * 100) / 100;
      const { error: parkError } = await supabase.from('charges').insert({
        lease_id: leaseId,
        tenant_id: lease.tenant_id,
        property_id: lease.property_id,
        entity_id: entityId,
        owner_entity_id: property?.owner_entity_id || entityId,
        charge_type: 'parking',
        description: `Parking (${input.parkingBays} bays × R${input.parkingRate}) — ${periodName}`,
        amount_excl_vat: parkingAmount,
        vat_rate: 15,
        vat_amount: parkingVat,
        amount_incl_vat: parkingAmount + parkingVat,
        recurrence_rule: { frequency: 'monthly', period: periodName },
        recovery_method: 'fixed',
        gl_code: '4200-001',
        is_active: true,
        status: 'posted',
        billing_period: periodName,
        financial_period: periodName,
      });
      if (!parkError) created++;
    }

    return created;
  }
}

export const leaseActivationService = new LeaseActivationService();
