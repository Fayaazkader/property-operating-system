import { supabase } from "../supabase";

type BillingRule = {
  id: string;
  lease_id: string;
  rule_type: string;
  description: string;
  base_amount: number;
  vat_rate: number;
  gl_code: string;
  recovery_method: string;
  frequency: string;
  escalation_percent: number | null;
  escalation_month: number | null;
  effective_from: string;
  effective_to: string | null;
  status: string;
};

export async function generateChargesFromRules(
  leaseId: string,
  periodStart: string,
  periodEnd: string
): Promise<number> {
  // Get active billing rules for this lease
  const { data: rules } = await supabase
    .from("billing_rules")
    .select("*")
    .eq("lease_id", leaseId)
    .eq("status", "active");

  if (!rules || rules.length === 0) return 0;

  // Get lease for property/entity context
  const { data: lease } = await supabase
    .from("leases")
    .select("property_id, tenant_id")
    .eq("id", leaseId)
    .single();

    const { data: property } = await supabase
    .from("properties")
    .select("entity_id, owner_entity_id, managing_entity_id")
    .eq("id", lease?.property_id)
    .single();

  const entityId = property?.entity_id || null;
  const ownerEntityId = property?.owner_entity_id || null;
  const managingEntityId = property?.managing_entity_id || null;
  const periodName = new Date(periodStart).toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
  let created = 0;

  for (const rule of rules as BillingRule[]) {
    // Skip utility_recovery — those come from meter imports
    if (rule.rule_type === "utility_recovery") continue;

    // Skip rules not yet effective
    if (new Date(rule.effective_from) > new Date(periodEnd)) continue;

    // Skip expired rules
    if (rule.effective_to && new Date(rule.effective_to) < new Date(periodStart)) continue;

    // Check if charge already exists for this rule + period
        const chargeDesc = `${rule.description} — ${periodName}`;
    const { data: existing } = await supabase
      .from("charges")
      .select("id")
      .eq("billing_rule_id", rule.id)
      .eq("lease_id", leaseId)
      .eq("billing_period", periodName)
      .limit(1);

    if (existing && existing.length > 0) continue;

    // Apply escalation if applicable
    let amount = rule.base_amount;
    if (rule.escalation_percent && rule.escalation_month) {
      const currentMonth = new Date(periodStart).getMonth() + 1;
      const ruleStartMonth = new Date(rule.effective_from).getMonth() + 1;
      const ruleStartYear = new Date(rule.effective_from).getFullYear();
      const currentYear = new Date(periodStart).getFullYear();
      
      // Calculate how many escalations should have been applied
      const monthsSinceStart = (currentYear - ruleStartYear) * 12 + (currentMonth - ruleStartMonth);
      const escalationCount = Math.floor(monthsSinceStart / 12);
      
      if (escalationCount > 0) {
        for (let i = 0; i < escalationCount; i++) {
          amount = amount * (1 + (rule.escalation_percent / 100));
        }
      }
    }

    const vatAmount = (amount * rule.vat_rate) / 100;
    const amountIncl = amount + vatAmount;

    await supabase.from("charges").insert({
      lease_id: leaseId,
      billing_rule_id: rule.id,
      source_type: 'billing_rule',
      source_id: rule.id,
      tenant_id: lease?.tenant_id,
      property_id: lease?.property_id,
      entity_id: entityId,
       owner_entity_id: ownerEntityId,
      managing_entity_id: managingEntityId,
      charge_type: rule.rule_type,
      description: chargeDesc,
      amount_excl_vat: Math.round(amount * 100) / 100,
      vat_rate: rule.vat_rate,
      vat_amount: Math.round(vatAmount * 100) / 100,
      amount_incl_vat: Math.round(amountIncl * 100) / 100,
      recurrence_rule: { frequency: rule.frequency, period: periodName },
      recovery_method: rule.recovery_method || "fixed",
      gl_code: rule.gl_code,
      is_active: true,
      status: "posted",
      billing_period: periodName,
      financial_period: periodName,
    });
    created++;
  }

  return created;
}

export async function generateChargesForPeriod(
  periodStart: string,
  periodEnd: string
): Promise<{ total: number; created: number }> {
  // Get all active leases
  const { data: leases } = await supabase
    .from("leases")
    .select("id")
    .not("property_id", "is", null)
    .not("tenant_id", "is", null);

  if (!leases || leases.length === 0) return { total: 0, created: 0 };

  let totalCreated = 0;
  for (const lease of leases) {
    totalCreated += await generateChargesFromRules(lease.id, periodStart, periodEnd);
  }

  return { total: leases.length, created: totalCreated };
}