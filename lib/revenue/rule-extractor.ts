import { supabase } from "../supabase";

export async function extractRulesFromLease(leaseId: string): Promise<number> {
  const { data: lease } = await supabase
    .from("leases")
    .select("id, lease_id, property_id, tenant_id, tenant_name, monthly_rental, escalation_percent, lease_start_date, lease_end_date, parking_bays, parking_rate, deposit_amount, security_levy, marketing_levy, storage_fee")
    .eq("id", leaseId)
    .single();

  if (!lease) return 0;

  const startDate = lease.lease_start_date || new Date().toISOString().split("T")[0];
  const endDate = lease.lease_end_date || null;
  const escalationMonth = new Date(startDate).getMonth() + 1;
  let created = 0;

  const rules: {
    rule_type: string;
    description: string;
    base_amount: number;
    vat_rate: number;
    gl_code: string;
    recovery_method?: string;
    escalation_percent?: number;
    escalation_month?: number;
    frequency?: string;
    effective_from: string;
    effective_to?: string | null;
  }[] = [];

  // 1. Rental Rule
  if (lease.monthly_rental && lease.monthly_rental > 0) {
    rules.push({
      rule_type: "rent",
      description: "Monthly Rental",
      base_amount: lease.monthly_rental,
      vat_rate: 15,
      gl_code: "4100-001",
      recovery_method: "fixed",
      escalation_percent: lease.escalation_percent || undefined,
      escalation_month: lease.escalation_percent ? escalationMonth : undefined,
      frequency: "monthly",
      effective_from: startDate,
      effective_to: endDate,
    });
  }

  // 2. Parking Rule
  const parkingRate = lease.parking_rate || 0;
  const parkingBays = lease.parking_bays || 0;
  if (parkingBays > 0 && parkingRate > 0) {
    rules.push({
      rule_type: "parking",
      description: `Parking (${parkingBays} bays × R${parkingRate})`,
      base_amount: parkingBays * parkingRate,
      vat_rate: 15,
      gl_code: "4200-001",
      recovery_method: "fixed",
      frequency: "monthly",
      effective_from: startDate,
      effective_to: endDate,
    });
  }

  // 3. Security Levy Rule
  if (lease.security_levy && lease.security_levy > 0) {
    rules.push({
      rule_type: "security_levy",
      description: "Security Levy",
      base_amount: lease.security_levy,
      vat_rate: 15,
      gl_code: "4400-002",
      recovery_method: "fixed",
      frequency: "monthly",
      effective_from: startDate,
      effective_to: endDate,
    });
  }

  // 4. Marketing Levy Rule
  if (lease.marketing_levy && lease.marketing_levy > 0) {
    rules.push({
      rule_type: "marketing_levy",
      description: "Marketing Levy",
      base_amount: lease.marketing_levy,
      vat_rate: 15,
      gl_code: "4400-003",
      recovery_method: "fixed",
      frequency: "monthly",
      effective_from: startDate,
      effective_to: endDate,
    });
  }

  // 5. Storage Rule
  if (lease.storage_fee && lease.storage_fee > 0) {
    rules.push({
      rule_type: "storage",
      description: "Storage Fee",
      base_amount: lease.storage_fee,
      vat_rate: 15,
      gl_code: "4200-002",
      recovery_method: "fixed",
      frequency: "monthly",
      effective_from: startDate,
      effective_to: endDate,
    });
  }

  // 6. Deposit Rule (one-time)
  if (lease.deposit_amount && lease.deposit_amount > 0) {
    rules.push({
      rule_type: "deposit",
      description: "Tenant Deposit",
      base_amount: lease.deposit_amount,
      vat_rate: 0,
      gl_code: "8100-001",
      recovery_method: "fixed",
      frequency: "once",
      effective_from: startDate,
    });
  }

  // 7. Utility Recovery Rule
  rules.push({
    rule_type: "utility_recovery",
    description: "Utility Recovery",
    base_amount: 0,
    vat_rate: 15,
    gl_code: "4300-001",
    recovery_method: "metered",
    frequency: "monthly",
    effective_from: startDate,
    effective_to: endDate,
  });

  // Insert rules (skip if identical rule already exists)
  for (const rule of rules) {
    const { data: existing } = await supabase
      .from("billing_rules")
      .select("id")
      .eq("lease_id", lease.id)
      .eq("rule_type", rule.rule_type)
      .eq("status", "active");

    if (existing && existing.length > 0) continue;

    await supabase.from("billing_rules").insert({
      lease_id: lease.id,
      rule_type: rule.rule_type,
      description: rule.description,
      base_amount: rule.base_amount,
      vat_rate: rule.vat_rate,
      gl_code: rule.gl_code,
      recovery_method: rule.recovery_method || "fixed",
      frequency: rule.frequency || "monthly",
      escalation_percent: rule.escalation_percent || null,
      escalation_month: rule.escalation_month || null,
      effective_from: rule.effective_from,
      effective_to: rule.effective_to || null,
      status: "active",
    });
    created++;
  }

  return created;
}

export async function extractRulesForAllLeases(): Promise<{ total: number; created: number }> {
  const { data: leases } = await supabase
    .from("leases")
    .select("id")
    .not("property_id", "is", null)
    .not("tenant_id", "is", null);

  if (!leases || leases.length === 0) return { total: 0, created: 0 };

  let totalCreated = 0;
  for (const lease of leases) {
    totalCreated += await extractRulesFromLease(lease.id);
  }
  return { total: leases.length, created: totalCreated };
}