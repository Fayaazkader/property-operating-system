// lib/workflows/lease-activation.ts
// Lease Activation Workflow
// Uses the authenticated supabase client passed from the API route

import { publish } from "@/lib/conversation/event-bus";

export async function activateLease(context: any, config: any) {
  const { intakeId, initiated_by, intake, supabase } = context;
  
  // Use the intake passed from the API route
  if (!intake) {
    return {
      success: false,
      step: "fetchIntake",
      message: "Intake not provided in context",
      blocking: true
    };
  }

  if (!supabase) {
    return {
      success: false,
      step: "noSupabase",
      message: "Supabase client not provided in context",
      blocking: true
    };
  }

  console.log("activateLease: Processing intake:", intake.id, "Status:", intake.status);

  // Validate readiness
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

  // Fetch tenant for entity context (using authenticated client)
  const { data: tenant } = await supabase
    .from("tenants")
    .select("entity_id, tenant_name, email, phone")
    .eq("id", intake.tenant_id)
    .single();

  // Create lease (using authenticated client)
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
    console.error("activateLease: Lease creation error:", leaseError);
    return {
      success: false,
      step: "createLease",
      message: leaseError.message,
      blocking: true
    };
  }

  console.log("✅ Lease created:", lease.id);

  // Update intake with lease_id
  const { error: updateError } = await supabase
    .from("lease_intake")
    .update({ 
      lease_id: lease.id,
      updated_at: new Date().toISOString()
    })
    .eq("id", intakeId);

  if (updateError) {
    console.error("activateLease: Intake update error:", updateError);
    return {
      success: false,
      step: "updateIntake",
      message: updateError.message,
      blocking: true
    };
  }

  // Update intake status to activated
  const { error: statusUpdateError } = await supabase
    .from("lease_intake")
    .update({ 
      status: "activated",
      activated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", intakeId);

  if (statusUpdateError) {
    console.error("activateLease: Status update error:", statusUpdateError);
    return {
      success: false,
      step: "updateStatus",
      message: statusUpdateError.message,
      blocking: true
    };
  }

  console.log("✅ Intake status updated to activated");

  // Store in context for next steps
  context.lease = lease;
  context.intake = intake;

  return {
    success: true,
    lease,
    intake
  };
}

export async function createBilling(context: any, config: any) {
  const { lease, intake, supabase } = context;

  if (!lease || !intake) {
    return {
      success: false,
      step: "createBilling",
      message: "Missing lease or intake data",
      blocking: true
    };
  }

  if (!supabase) {
    return {
      success: false,
      step: "createBilling",
      message: "Supabase client not provided",
      blocking: true
    };
  }

  console.log("createBilling: Creating billing for lease:", lease.id);

  // Create billing rule for monthly rental
  const { data: billingRule, error: billingError } = await supabase
    .from("billing_rules")
    .insert({
      lease_id: lease.id,
      rule_type: "monthly_rental",
      description: `Monthly rental for ${intake.applicant_name}`,
      base_amount: intake.monthly_rental,
      frequency: "monthly",
      escalation_percent: intake.escalation_percent || 0,
      effective_from: intake.commencement_date,
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (billingError) {
    console.error("createBilling: Error:", billingError);
    return {
      success: false,
      step: "createBilling",
      message: billingError.message,
      blocking: true
    };
  }

  console.log("✅ Billing rule created:", billingRule.id);

  // Create deposit ledger entry
  const { data: depositLedger, error: depositError } = await supabase
    .from("deposit_ledger")
    .insert({
      lease_id: lease.id,
      tenant_id: intake.tenant_id,
      amount: intake.deposit_amount,
      status: "held",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (depositError) {
    console.error("createBilling: Deposit error:", depositError);
    return {
      success: false,
      step: "createDepositLedger",
      message: depositError.message,
      blocking: true
    };
  }

  console.log("✅ Deposit ledger created:", depositLedger.id);

  return {
    success: true,
    billingRule,
    depositLedger
  };
}

export async function notifyTenant(context: any, config: any) {
  const { lease, intake, supabase } = context;

  if (!lease || !intake) {
    return {
      success: false,
      step: "notifyTenant",
      message: "Missing lease or intake data",
      blocking: true
    };
  }

  if (!supabase) {
    return {
      success: false,
      step: "notifyTenant",
      message: "Supabase client not provided",
      blocking: true
    };
  }

  console.log("notifyTenant: Sending notifications for lease:", lease.id);

  // Update unit occupancy
  if (intake.unit_id) {
    const { error: unitError } = await supabase
      .from("units")
      .update({
        occupancy_status: "occupied",
        current_tenant_name: intake.applicant_name,
        current_lease_id: lease.id,
        current_rental_rate: intake.monthly_rental,
        updated_at: new Date().toISOString()
      })
      .eq("id", intake.unit_id);

    if (unitError) {
      console.error("notifyTenant: Unit update error:", unitError);
    } else {
      console.log("✅ Unit updated:", intake.unit_id);
    }
  }

  // Publish lease.activated event
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
      initiated_by: context.initiated_by || "system",
      occurred_at: new Date().toISOString()
    }
  });

  console.log("✅ lease.activated event published");

  return { 
    success: true, 
    event: "lease.activated",
    resources_created: {
      lease: lease.id,
    }
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
