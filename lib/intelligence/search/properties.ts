export async function searchProperties(supabase: any, query: string, entityIds: string[]) {
  const { data } = await supabase
    .from("properties")
    .select("id, property_name, city")
    .in("entity_id", entityIds)
    .or(`property_name.ilike.%${query}%,city.ilike.%${query}%`)
    .limit(5);
  return (data || []).map((p: any) => ({
    type: "property",
    id: p.id,
    label: p.property_name,
    sublabel: p.city,
    href: `/properties`,
  }));
}
