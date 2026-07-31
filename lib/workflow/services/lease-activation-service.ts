import { supabase } from '@/lib/supabase';
import { extractRulesFromLease } from '@/lib/revenue/rule-extractor';
import { generateChargesFromRules } from '@/lib/revenue/charge-generator';
import { publish } from '@/lib/platform/events/event-bus';
import type { ActivationResult } from '../domain/activation-context';

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

    // Phase 1: Atomic tenant + lease + contacts + documents via PostgreSQL RPC
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

    if (rpcError || !rpcResult?.success) {
      throw new Error(rpcResult?.error || rpcError?.message || 'Activation failed');
    }

    // Phase 2: Billing rules and charges (idempotent — safe to retry)
    const rulesCreated = await extractRulesFromLease(rpcResult.lease_id);
    const periodStart = new Date().toISOString().split('T')[0];
    const periodEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0).toISOString().split('T')[0];
    const chargesGenerated = await generateChargesFromRules(rpcResult.lease_id, periodStart, periodEnd);

    // Phase 3: Publish event ONLY after everything succeeded
    await publish('lease.activated', {
      correlationId: crypto.randomUUID(),
      source: 'lease-activation-service',
      version: '1.0',
      payload: {
        tenantId: rpcResult.tenant_id,
        leaseId: rpcResult.lease_id,
        leaseRef: rpcResult.lease_ref,
        entityId: input.entityId,
      },
    });

    const duration = Date.now() - startedAt;

    return {
      tenantId: rpcResult.tenant_id,
      leaseId: rpcResult.lease_id,
      tenantCode: rpcResult.tenant_code,
      leaseRef: rpcResult.lease_ref,
      rulesCreated,
      chargesGenerated,
      documentsAttached: rpcResult.documents_attached || 0,
      contactsCreated: rpcResult.contacts_created || 0,
      warnings: 0,
      duration,
      events: ['tenant_created', 'contact_created', 'lease_created', 'document_attached', 'billing_rules_extracted', 'charges_generated', 'unit_updated', 'event_published'],
    };
  }
}

export const leaseActivationService = new LeaseActivationService();
