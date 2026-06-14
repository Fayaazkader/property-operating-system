import { supabase } from "../supabase";

type EscalationDue = {
  lease_id: string;
  lease_name: string;
  tenant_name: string;
  rule_id: string;
  rule_type: string;
  current_amount: number;
  escalation_percent: number;
  new_amount: number;
  effective_month: string;
};

export async function detectEscalationsDue(month?: number, year?: number): Promise<EscalationDue[]> {
  const now = new Date();
  const targetMonth = month || now.getMonth() + 1;
  const targetYear = year || now.getFullYear();

  // Find active billing rules with escalation due this month
  const { data: rules } = await supabase
    .from("billing_rules")
    .select("*, leases(id, lease_id, tenant_name)")
    .eq("status", "active")
    .eq("escalation_month", targetMonth)
    .gt("escalation_percent", 0);

  if (!rules || rules.length === 0) return [];

  const escalations: EscalationDue[] = [];

  for (const rule of rules) {
    const lease = (rule as any).leases;
    if (!lease) continue;

    const newAmount = rule.base_amount * (1 + (rule.escalation_percent / 100));

    escalations.push({
      lease_id: rule.lease_id,
      lease_name: lease.lease_id,
      tenant_name: lease.tenant_name,
      rule_id: rule.id,
      rule_type: rule.rule_type,
      current_amount: rule.base_amount,
      escalation_percent: rule.escalation_percent,
      new_amount: Math.round(newAmount * 100) / 100,
      effective_month: `${targetYear}-${String(targetMonth).padStart(2, "0")}`,
    });
  }

  return escalations;
}

export async function applyEscalation(ruleId: string, newAmount: number): Promise<boolean> {
  const { error } = await supabase
    .from("billing_rules")
    .update({
      base_amount: newAmount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ruleId);

  return !error;
}

export async function skipEscalation(ruleId: string, reason: string): Promise<boolean> {
  const { error } = await supabase
    .from("billing_rules")
    .update({
      escalation_percent: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ruleId);

  return !error;
}