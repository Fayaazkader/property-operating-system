export type TenantStatement = {
  period: string;
  sent_at: string;
};

export async function getTenantStatements(supabase: any, tenantId: string, limit = 5): Promise<TenantStatement[]> {
  const { data } = await supabase
    .from("communications")
    .select("source_id, sent_at")
    .eq("tenant_id", tenantId)
    .eq("event_type", "statement_available")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data || []).map((c: any) => ({
    period: c.source_id?.replace("INV-", "") || "Unknown",
    sent_at: c.sent_at,
  }));
}
