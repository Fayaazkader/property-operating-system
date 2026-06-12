import { supabase } from "../supabase";

export async function generateChargesForLease(leaseId: string): Promise<number> {
  const { data: lease } = await supabase
    .from("leases")
    .select("id, lease_id, property_id, tenant_id, tenant_name, monthly_rental, escalation_percent, lease_start_date, lease_end_date")
    .eq("id", leaseId)
    .single();

  if (!lease || !lease.monthly_rental || lease.monthly_rental <= 0) return 0;

  const { data: property } = await supabase
    .from("properties")
    .select("entity_id")
    .eq("id", lease.property_id)
    .single();

  const entityId = property?.entity_id || null;
  const startDate = lease.lease_start_date || new Date().toISOString().split("T")[0];
  const endDate = lease.lease_end_date || undefined;
  let created = 0;

  // Monthly Rental
  const { data: existingRent } = await supabase
    .from("charges")
    .select("id")
    .eq("lease_id", lease.id)
    .eq("charge_type", "rent")
    .eq("is_active", true);

  if (!existingRent || existingRent.length === 0) {
    const vatAmount = (lease.monthly_rental * 15) / 100;
    await supabase.from("charges").insert({
      lease_id: lease.id,
      tenant_id: lease.tenant_id,
      property_id: lease.property_id,
      entity_id: entityId,
      charge_type: "rent",
      description: "Monthly Rental",
      amount_excl_vat: lease.monthly_rental,
      vat_rate: 15,
      vat_amount: vatAmount,
      amount_incl_vat: lease.monthly_rental + vatAmount,
      recurrence_rule: { frequency: "monthly", day: 1, start: startDate, end: endDate },
      escalation_rule: lease.escalation_percent && lease.escalation_percent > 0
        ? { percentage: lease.escalation_percent, frequency: "annual", month: new Date(startDate).getMonth() + 1 }
        : {},
      recovery_method: "fixed",
      gl_code: "4100-001",
      is_active: true,
    });
    created++;
  }

  // Utility Recovery placeholder
  const { data: existingUtility } = await supabase
    .from("charges")
    .select("id")
    .eq("lease_id", lease.id)
    .eq("charge_type", "utility_recovery")
    .eq("is_active", true);

  if (!existingUtility || existingUtility.length === 0) {
    await supabase.from("charges").insert({
      lease_id: lease.id,
      tenant_id: lease.tenant_id,
      property_id: lease.property_id,
      entity_id: entityId,
      charge_type: "utility_recovery",
      description: "Utility Recovery",
      amount_excl_vat: 0,
      vat_rate: 15,
      vat_amount: 0,
      amount_incl_vat: 0,
      recurrence_rule: { frequency: "monthly", day: 1, start: startDate, end: endDate },
      recovery_method: "variable",
      gl_code: "4200-001",
      is_active: true,
    });
    created++;
  }

  return created;
}

export async function generateChargesForAllLeases(): Promise<{ total: number; created: number }> {
  const { data: leases } = await supabase
    .from("leases")
    .select("id")
    .not("property_id", "is", null)
    .not("tenant_id", "is", null);

  if (!leases || leases.length === 0) return { total: 0, created: 0 };

  let totalCreated = 0;
  for (const lease of leases) {
    totalCreated += await generateChargesForLease(lease.id);
  }

  return { total: leases.length, created: totalCreated };
}