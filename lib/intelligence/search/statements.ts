export async function searchStatements(supabase: any, query: string, entityIds: string[]) {
  const { data } = await supabase
    .from("communications")
    .select("source_id, tenant_id")
    .eq("event_type", "statement_available")
    .ilike("source_id", `%${query}%`)
    .limit(5);
  return (data || []).map((c: any) => ({
    type: "statement",
    label: c.source_id?.replace("INV-", "Statement: "),
    href: `/financials/revenue`,
  }));
}
