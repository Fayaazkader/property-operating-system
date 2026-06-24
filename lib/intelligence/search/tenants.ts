export async function searchTenants(supabase: any, query: string, entityIds: string[]) {
  const { data } = await supabase
    .from("tenants")
    .select("id, tenant_name, email")
    .in("entity_id", entityIds)
    .ilike("tenant_name", `%${query}%`)
    .limit(5);
  return (data || []).map((t: any) => ({
    type: "tenant",
    id: t.id,
    label: t.tenant_name,
    sublabel: t.email,
    href: `/tenants`,
  }));
}
