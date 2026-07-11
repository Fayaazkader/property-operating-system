// lib/workflows/lease-activation.ts
// Lease Activation Workflow
// Leasing owns: Create lease, Update intake status, Publish event
// Everything else: Downstream domains react via event subscribers

import { supabase } from "@/lib/supabase";
import { publish } from "@/lib/conversation/event-bus";

export async function activateLease(context: any, config: any) {
  const { intakeId, initiated_by } = context;
  
  // 1. Fetch intake
  const { data: intake, error: intakeError } = await supabase
    .from("lease_intake")
    .select("*")
    .eq("id", intakeId)
    .single();

  if (intakeError || !intake) {
    return {
      success: false,
      step: "fetchIntake",
      message: "Intake not found",
      blocking: true
    };
  }

  // 2. Validate readiness
  const readiness = await validateReadiness(intake);
  
  if (!readiness.ready) {
    return {
      success: false,
      step: "validation",
      message: "Readiness check failed",
      blocking: true,
      details: {
        critical: readiness.critical,
        warnings: readiness.warnings
      }
    };
  }

  // 3. Fetch tenant for entity context
  const { data: tenant } = await supabase
    .from("tenants")
    .select("entity_id, tenant_name, email, phone")
    .eq("id", intake.tenant_id)
    .single();

  // 4. Create lease (Leasing owns this)
  const { data: lease, error: leaseError } = await supabase
    .from("leases")
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
      lease_status: "executed",
      owner_entity_id: tenant?.entity_id || intake.entity_id,
      managing_entity_id: tenant?.entity_id || intake.entity_id,
      tenant_name: intake.applicant_name,
      company_registration: intake.company_registration,
      lease_start_date: intake.commencement_date,
      lease_end_date: intake.expiry_date,
      broker_id: intake.broker_id || null,
      broker_company: intake.broker_company || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (leaseError) {
    return {
      success: false,
      step: "createLease",
      message: leaseError.message,
      blocking: true
    };
  }

  // 5. Update intake (Leasing owns this)
  const { error: updateError } = await supabase
    .from("lease_intake")
    .update({ 
      lease_id: lease.id,
      status: "activated",
      activated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: initiated_by
    })
    .eq("id", intakeId);

  if (updateError) {
    return {
      success: false,
      step: "updateIntake",
      message: updateError.message,
      blocking: true
    };
  }

  // 6. Create timeline entry (Leasing owns this)
  await supabase.from("lease_timeline").insert({
    intake_id: intake.id,
    event: "activated",
    description: "Lease activated",
    created_by: initiated_by || "system",
    created_at: new Date().toISOString()
  });

  // 7. Publish lease.activated event
  await publish("lease.activated", {
    event: "lease.activated",
    tenantId: intake.tenant_id,
    propertyId: intake.property_id,
    data: {
      lease_id: lease.id,
      intake_id: intake.id,
      tenant_id: intake.tenant_id,
      property_id: intake.property_id,
      unit_id: intake.unit_id,
      monthly_rental: intake.monthly_rental,
      deposit_amount: intake.deposit_amount,
      commencement_date: intake.commencement_date,
      expiry_date: intake.expiry_date,
      escalation_percent: intake.escalation_percent || 0,
      parking_bays: intake.parking_bays || 0,
      tenant_name: intake.applicant_name,
      company_registration: intake.company_registration,
      contact_email: intake.contact_email,
      contact_phone: intake.contact_phone,
      entity_id: intake.entity_id,
      broker_id: intake.broker_id || null,
      broker_company: intake.broker_company || null,
      commercial_terms: {
        monthly_rental: intake.monthly_rental,
        deposit_amount: intake.deposit_amount,
        escalation_percent: intake.escalation_percent || 0,
        parking_bays: intake.parking_bays || 0,
        lease_term_months: intake.lease_term_months
      },
      initiated_by: initiated_by || "system",
      occurred_at: new Date().toISOString()
    }
  });

  return {
    success: true,
    lease,
    intake,
    events_published: ["lease.activated"]
  };
}

async function validateReadiness(intake: any) {
  const critical: string[] = [];
  const warnings: string[] = [];

  if (!intake.monthly_rental) critical.push("Monthly Rental missing");
  if (!intake.deposit_amount) critical.push("Deposit Amount missing");
  if (!intake.commencement_date) critical.push("Commencement Date missing");
  if (!intake.tenant_id) critical.push("Tenant not selected");
  if (!intake.property_id) critical.push("Property not selected");
  if (!intake.unit_id) critical.push("Unit not selected");
  if (!intake.lease_term_months) critical.push("Lease Term missing");

  if (!intake.contact_email) warnings.push("Contact Email missing");
  if (!intake.contact_phone) warnings.push("Contact Phone missing");
  if (!intake.company_registration) warnings.push("Company Registration missing");
  if (!intake.broker_id) warnings.push("No broker assigned (optional)");

  if (intake.status !== "fully_executed" && intake.status !== "ready_for_activation") {
    critical.push(`Intake status is "${intake.status}", must be "fully_executed" or "ready_for_activation"`);
  }

  return {
    ready: critical.length === 0,
    critical,
    warnings
  };
}
