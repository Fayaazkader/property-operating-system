import { supabase } from '@/lib/supabase';
import { leaseNumberService } from './lease-number-service';
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
    const events: string[] = [];
    let tenantId = '';
    let leaseId = '';
    let leaseRef = '';

    try {
      // 1. Create Tenant
      const { data: tenant, error: tenantError } = await supabase.from('tenants').insert({
        tenant_name: input.tenantName,
        company_registration: input.companyRegistration,
        vat_number: input.vatNumber,
        email: input.email,
        phone: input.phone,
        entity_id: input.entityId,
        tenant_type: 'Company',
        status: 'Active',
        kyc_status: 'Approved',
        code: input.tenantName.substring(0, 4).toUpperCase(),
      }).select('id').single();
      if (tenantError) throw tenantError;
      tenantId = tenant.id;
      events.push('tenant_created');

      // 2. Create Contact
      if (input.email || input.phone) {
        await supabase.from('tenant_contacts').insert({
          tenant_id: tenantId,
          contact_type: 'primary',
          email: input.email,
          phone: input.phone,
          is_primary: true,
        });
        events.push('contact_created');
      }

      // 3. Generate lease number
      const propertyCode = 'PROP';
      leaseRef = await leaseNumberService.generate(propertyCode);

      // 4. Create Lease
      const { data: lease, error: leaseError } = await supabase.from('leases').insert({
        client_id: tenantId,
        tenant_id: tenantId,
        property_id: input.propertyId,
        unit_id: input.unitId,
        owner_entity_id: input.entityId,
        lease_id: leaseRef,
        lease_status: 'Active',
        monthly_rental: input.monthlyRental,
        lease_start_date: input.leaseStartDate,
        lease_end_date: input.leaseEndDate,
        escalation_percent: input.escalationPercent,
        deposit_amount: input.depositAmount,
        parking_bays: input.parkingBays,
        parking_rate: input.parkingRate,
        lease_type: 'commercial',
      }).select('id').single();
      if (leaseError) throw leaseError;
      leaseId = lease.id;
      events.push('lease_created');

      // 5. Attach document
      let documentsAttached = 0;
      if (input.documentFile) {
        await supabase.from('documents').insert({
          entity_id: input.entityId,
          file_name: input.documentFile.name,
          file_url: input.documentFile.url,
          mime_type: 'application/pdf',
          document_type: 'signed_lease',
          status: 'stored',
          tenant_id: tenantId,
          property_id: input.propertyId,
          related_entity_type: 'lease',
          related_entity_id: leaseId,
        });
        documentsAttached = 1;
        events.push('document_attached');
      }

      // 6. Extract Billing Rules
      const rulesCreated = await extractRulesFromLease(leaseId);
      events.push('billing_rules_extracted');

      // 7. Generate Charges
      const periodStart = new Date().toISOString().split('T')[0];
      const periodEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0).toISOString().split('T')[0];
      const chargesGenerated = await generateChargesFromRules(leaseId, periodStart, periodEnd);
      events.push('charges_generated');

      // 8. Update unit occupancy
      await supabase.from('units').update({ occupancy_status: 'Occupied' }).eq('id', input.unitId);
      events.push('unit_updated');

      // 9. Publish event
      await publish('lease.activated', {
        correlationId: crypto.randomUUID(),
        source: 'lease-activation-service',
        version: '1.0',
        payload: { tenantId, leaseId, leaseRef, entityId: input.entityId },
      });

      const duration = Date.now() - startedAt;

      return {
        tenantId,
        leaseId,
        tenantCode: input.tenantName.substring(0, 4).toUpperCase(),
        leaseRef,
        rulesCreated,
        chargesGenerated,
        documentsAttached,
        contactsCreated: (input.email || input.phone) ? 1 : 0,
        warnings: 0,
        duration,
        events,
      };
    } catch (err: any) {
      // Best-effort rollback
      if (leaseId) await supabase.from('leases').delete().eq('id', leaseId);
      if (tenantId) await supabase.from('tenants').delete().eq('id', tenantId);
      throw err;
    }
  }
}

export const leaseActivationService = new LeaseActivationService();
