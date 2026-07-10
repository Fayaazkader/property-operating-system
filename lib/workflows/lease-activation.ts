// Lease Activation Workflow
// Signed lease received → Activate → Create Billing → Notify Tenant

export async function activateLease(context: any, config: any) {
  const { supabase } = await import("@/lib/supabase");
  const { leaseId } = context;
  
  await supabase.from("leases").update({ lease_status: "Active" }).eq("id", leaseId);
  return { activated: true, leaseId };
}

export async function createBilling(context: any, config: any) {
  const { supabase } = await import("@/lib/supabase");
  const { leaseId, extractedFields } = context;
  
  await supabase.from("billing_rules").insert({
    lease_id: leaseId,
    rule_type: "rent",
    description: "Monthly Rental",
    base_amount: extractedFields.rental_amount,
    frequency: "monthly",
    effective_from: extractedFields.lease_start_date || new Date().toISOString().split("T")[0],
    status: "active",
  });
  
  return { billingCreated: true };
}

export async function notifyTenant(context: any, config: any) {
  const { publish } = await import("@/lib/conversation/event-bus");
  publish("lease_activated", {
    event: "lease_activated",
    tenantId: context.tenantId,
    data: { leaseId: context.leaseId },
  });
  return { notified: true };
}
