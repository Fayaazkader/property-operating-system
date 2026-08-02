import { supabase } from '@/lib/supabase';
import { extractRulesFromLease } from '@/lib/revenue/rule-extractor';
import { initialBillingService } from '@/lib/revenue/initial-billing-service';
import { publish } from '@/lib/platform/events/event-bus';
import { workflowStatusEngine } from '@/lib/workflow/services/workflow-status-engine';
import { operationalJournal } from '@/lib/workflow/services/operational-journal';
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

function parseDate(d: string): string {
  if (!d) return '';
  if (d.includes('-')) return d; // Already YYYY-MM-DD
  const parts = d.split('/');
  if (parts.length === 3) return parts[2] + '-' + parts[1] + '-' + parts[0];
  return d;
}

export class LeaseActivationService {
  async execute(input: ActivationInput): Promise<ActivationResult> {
    const startedAt = Date.now();

    const { data: rpcResult, error: rpcError } = await supabase.rpc('activate_lease', {
      p_entity_id: input.entityId, p_tenant_name: input.tenantName,
      p_company_registration: input.companyRegistration || null,
      p_vat_number: input.vatNumber || null, p_email: input.email || null,
      p_phone: input.phone || null, p_property_id: input.propertyId,
      p_unit_id: input.unitId, p_monthly_rental: input.monthlyRental,
      p_lease_start_date: parseDate(input.leaseStartDate), p_lease_end_date: parseDate(input.leaseEndDate),
      p_escalation_percent: input.escalationPercent, p_deposit_amount: input.depositAmount,
      p_parking_bays: input.parkingBays, p_parking_rate: input.parkingRate,
      p_document_name: input.documentFile?.name || null,
      p_document_url: input.documentFile?.url || null,
    });

    if (rpcError) throw rpcError;
    const result = rpcResult as unknown as ActivateLeaseRpcResult;
    if (!result?.tenant_id) throw new Error('Activation RPC returned no data');

    // Create workflow state
    const wf = await workflowStatusEngine.create(
      "lease_activation", input.entityId, "lease", result.lease_id,
      ["Tenant Created", "Lease Created", "Rules Extracted", "Initial Billing", "Revenue Active"]
    );
    await workflowStatusEngine.advanceStep(wf.id, "Tenant Created");

    const rulesCreated = await extractRulesFromLease(result.lease_id);
    await workflowStatusEngine.advanceStep(wf.id, "Rules Extracted");
    // Initial billing is now handled by the InitialBillingModal UI
    // The user reviews and approves charges before posting
    const commencement = { totalCreated: 0, depositCreated: 0, rentalCreated: 0, parkingCreated: 0 };

    await operationalJournal.log({
      entity_id: input.entityId, reference_type: "lease", reference_id: result.lease_id,
      event_type: "lease_activated", description: `Lease ${result.lease_ref} activated for ${input.tenantName}`,
    });

    // Trigger signing workflow
    await publish('lease.ready_for_execution', {
      correlationId: crypto.randomUUID(),
      source: 'lease-activation-service',
      version: '1.0',
      payload: { tenantId: result.tenant_id, leaseId: result.lease_id, leaseRef: result.lease_ref, entityId: input.entityId },
    });

    await publish('lease.activated', {
      correlationId: crypto.randomUUID(), source: 'lease-activation-service', version: '1.0',
      payload: { tenantId: result.tenant_id, leaseId: result.lease_id, leaseRef: result.lease_ref, entityId: input.entityId },
    });

    return {
      tenantId: result.tenant_id, leaseId: result.lease_id,
      tenantCode: result.tenant_code, leaseRef: result.lease_ref,
      rulesCreated,
      chargesGenerated: commencement.totalCreated,
      documentsAttached: result.documents_attached || 0,
      contactsCreated: result.contacts_created || 0,
      warnings: 0,
      duration: Date.now() - startedAt,
      events: ['tenant_created', 'lease_created', 'billing_rules_extracted', 'commencement_charges_created', 'event_published'],
    };
  }
}

export const leaseActivationService = new LeaseActivationService();
