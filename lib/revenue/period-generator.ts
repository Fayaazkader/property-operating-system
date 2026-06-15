import { supabase } from "../supabase";
import { generateChargesFromRules } from "./charge-generator";

export async function generateChargesForNewPeriod(
  periodStart: string,
  periodEnd: string,
  periodName: string
): Promise<{ total: number; generated: number }> {
  const { data: activeLeases } = await supabase
    .from("leases")
    .select("id")
    .not("property_id", "is", null)
    .not("tenant_id", "is", null)
    .eq("lease_status", "Active");

  if (!activeLeases || activeLeases.length === 0) return { total: 0, generated: 0 };

  let totalGenerated = 0;
  for (const lease of activeLeases) {
    const generated = await generateChargesFromRules(lease.id, periodStart, periodEnd);
    totalGenerated += generated;
  }

  return { total: activeLeases.length, generated: totalGenerated };
}