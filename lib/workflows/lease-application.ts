// Lease Application Intake Workflow
// Forward PDF → Extract → Draft Lease → Notify Manager

export async function validateDocument(context: any, config: any) {
  const { extractedFields } = context;
  return {
    valid: extractedFields.tenant_name && extractedFields.rental_amount,
    missingFields: extractedFields.missingFields,
  };
}

export async function draftLease(context: any, config: any) {
  const { extractedFields, tenantId } = context;
  // Create draft lease in the system
  const { supabase } = await import("@/lib/supabase");
  
  const { data: lease } = await supabase.from("leases").insert({
    tenant_name: extractedFields.tenant_name,
    monthly_rental: extractedFields.rental_amount,
    deposit_amount: extractedFields.deposit_amount,
    escalation_percent: extractedFields.escalation_percent,
    lease_start_date: extractedFields.lease_start_date,
    lease_end_date: extractedFields.lease_end_date,
    parking_bays: extractedFields.parking_bays,
    lease_status: "Draft",
  }).select("id").single();

  return { leaseId: lease?.id, status: "draft" };
}

export async function notifyManager(context: any, config: any) {
  // Notify property manager about new draft lease
  const { publish } = await import("@/lib/conversation/event-bus");
  publish("lease_draft_ready", {
    event: "lease_draft_ready",
    tenantId: context.tenantId,
    data: { leaseId: context.leaseId, ...context.extractedFields },
  });
  return { notified: true };
}
