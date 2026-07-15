// lib/services/activation.service.ts
// Activation Service — Owns lease activation business logic

import { supabase } from "@/lib/supabase";
import { publish, Events } from "@/lib/platform/events";
import { LeaseActivatedPayload } from "@/lib/platform/events/contract";
import { logger } from "@/lib/platform/events/logger.service";

export interface ActivationResult {
  success: boolean;
  leaseId?: string;
  intakeId: string;
  error?: string;
}

export class ActivationService {
  private supabase = supabase;

  async activate(intakeId: string, initiatedBy?: string): Promise<ActivationResult> {
    try {
      // 1. Fetch intake
      const { data: intake, error: intakeError } = await this.supabase
        .from('lease_intake')
        .select('*')
        .eq('id', intakeId)
        .single();

      if (intakeError || !intake) {
        return {
          success: false,
          intakeId,
          error: 'Intake not found',
        };
      }

      // 2. Validate readiness
      const missingFields = this.validateReadiness(intake);
      if (missingFields.length > 0) {
        return {
          success: false,
          intakeId,
          error: `Missing required fields: ${missingFields.join(', ')}`,
        };
      }

      // 3. Create lease
      const { data: lease, error: leaseError } = await this.supabase
        .from('leases')
        .insert({
          tenant_id: intake.tenant_id,
          property_id: intake.property_id,
          unit_id: intake.unit_id,
          monthly_rental: intake.monthly_rental,
          deposit_amount: intake.deposit_amount,
          commencement_date: intake.commencement_date,
          expiry_date: intake.expiry_date,
          escalation_percent: intake.escalation_percent || 0,
          parking_bays: intake.parking_bays || 0,
          lease_status: 'executed',
          tenant_name: intake.applicant_name,
          company_registration: intake.company_registration,
          lease_start_date: intake.commencement_date,
          lease_end_date: intake.expiry_date,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (leaseError) {
        return {
          success: false,
          intakeId,
          error: leaseError.message,
        };
      }

      // 4. Update intake status
      const { error: updateError } = await this.supabase
        .from('lease_intake')
        .update({
          status: 'activated',
          activated_at: new Date().toISOString(),
          lease_id: lease.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', intakeId);

      if (updateError) {
        return {
          success: false,
          intakeId,
          error: updateError.message,
        };
      }

      // 5. Update unit occupancy
      if (intake.unit_id) {
        await this.supabase
          .from('units')
          .update({
            occupancy_status: 'occupied',
            current_tenant_name: intake.applicant_name,
            current_lease_id: lease.id,
            current_rental_rate: intake.monthly_rental,
            updated_at: new Date().toISOString(),
          })
          .eq('id', intake.unit_id);
      }

      // 6. Publish lease.activated event (Service owns this)
      const payload: LeaseActivatedPayload = {
        intakeId: intake.id,
        leaseId: lease.id,
        activatedAt: new Date().toISOString(),
        monthlyRental: intake.monthly_rental || 0,
      };

      await publish(Events.Lease.Activated, {
        correlationId: intakeId,
        source: 'activation-service',
        version: '1.0',
        actor: initiatedBy ? { id: initiatedBy, type: 'user' } : undefined,
        entity: {
          id: lease.id,
          type: 'lease',
          tenantId: intake.tenant_id || undefined,
          propertyId: intake.property_id || undefined,
        },
        payload,
      });

      logger.info('✅ Lease activated', {
        leaseId: lease.id,
        intakeId,
        initiatedBy,
      });

      return {
        success: true,
        leaseId: lease.id,
        intakeId,
      };

    } catch (error) {
      logger.error('Activation service error:', { error, intakeId });
      return {
        success: false,
        intakeId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private validateReadiness(intake: any): string[] {
    const missing: string[] = [];
    if (!intake.monthly_rental) missing.push('monthly_rental');
    if (!intake.deposit_amount) missing.push('deposit_amount');
    if (!intake.commencement_date) missing.push('commencement_date');
    if (!intake.tenant_id) missing.push('tenant_id');
    if (!intake.property_id) missing.push('property_id');
    if (!intake.unit_id) missing.push('unit_id');
    return missing;
  }
}

export const activationService = new ActivationService();
