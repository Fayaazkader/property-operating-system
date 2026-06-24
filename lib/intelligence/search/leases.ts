export async function searchLeases(supabase: any, query: string, entityIds: string[]) {
  const { data } = await supabase
    .from("leases")
    .select("id, lease_id, tenant_name, property_name")
    .in("owner_entity_id", entityIds)
    .or(`lease_id.ilike.%${query}%,tenant_name.ilike.%${query}%,property_name.ilike.%${query}%`)
    .limit(5);
  return (data || []).map((l: any) => ({
    type: "lease",
    id: l.id,
    label: l.lease_id,
    sublabel: `${l.tenant_name} · ${l.property_name}`,
    href: `/leases/${l.id}`,
  }));
}
