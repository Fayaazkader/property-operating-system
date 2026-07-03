import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const entityId = url.searchParams.get("entity") || "";
  const propertyId = url.searchParams.get("property") || "";

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set({ name, value, ...options }));
        },
      },
    }
  );

  let propQuery = supabase.from("properties").select("id, property_name, property_code, property_type, province, total_gla_sqm, number_of_units, operational_region, entity_id").order("property_name");
  if (entityId) propQuery = propQuery.eq("entity_id", entityId);
  if (propertyId) propQuery = propQuery.eq("id", propertyId);

  const { data: properties } = await propQuery;
  if (!properties) return NextResponse.json({ occupancy: [], summary: {} });

  const propertyIds = properties.map(p => p.id);
  const entityIds = properties.map(p => p.entity_id).filter(Boolean);

  const { data: units } = await supabase.from("units").select("property_id, occupancy_status, current_rental_rate, gla_sqm").in("property_id", propertyIds);
  const { data: entities } = await supabase.from("entities").select("id, entity_name").in("id", entityIds);

  const entityMap = new Map(entities?.map(e => [e.id, e]) || []);

  const occupancyData = properties.map(p => {
    const propertyUnits = units?.filter(u => u.property_id === p.id) || [];
    const totalUnits = propertyUnits.length || p.number_of_units || 0;
    const occupied = propertyUnits.filter(u => u.occupancy_status === 'Occupied').length;
    const vacant = totalUnits - occupied;
    const occupancyPct = totalUnits > 0 ? Math.round((occupied / totalUnits) * 100) : 0;
    const totalGLA = propertyUnits.reduce((s, u) => s + (u.gla_sqm || 0), 0) || p.total_gla_sqm || 0;
    const vacantGLA = propertyUnits.filter(u => u.occupancy_status !== 'Occupied').reduce((s, u) => s + (u.gla_sqm || 0), 0);
    const estimatedRental = propertyUnits.filter(u => u.occupancy_status === 'Vacant').reduce((s, u) => s + (u.current_rental_rate || 0), 0);

    return {
      property_name: p.property_name,
      property_code: p.property_code,
      property_type: p.property_type,
      region: p.province,
      portfolio: p.operational_region || "—",
      entity_name: entityMap.get(p.entity_id)?.entity_name || "—",
      total_units: totalUnits,
      occupied,
      vacant,
      occupancy_pct: occupancyPct,
      total_gla: totalGLA,
      vacant_gla: vacantGLA,
      estimated_vacancy_cost: estimatedRental,
    };
  });

  const totalUnits = occupancyData.reduce((s, p) => s + p.total_units, 0);
  const totalOccupied = occupancyData.reduce((s, p) => s + p.occupied, 0);
  const totalVacant = occupancyData.reduce((s, p) => s + p.vacant, 0);
  const totalGLA = occupancyData.reduce((s, p) => s + p.total_gla, 0);
  const totalVacantGLA = occupancyData.reduce((s, p) => s + p.vacant_gla, 0);
  const totalVacancyCost = occupancyData.reduce((s, p) => s + p.estimated_vacancy_cost, 0);

  return NextResponse.json({
    occupancy: occupancyData,
    summary: {
      totalProperties: occupancyData.length,
      totalUnits,
      totalOccupied,
      totalVacant,
      occupancyPct: totalUnits > 0 ? Math.round((totalOccupied / totalUnits) * 100) : 0,
      totalGLA,
      totalVacantGLA,
      totalVacancyCost,
    },
  });
}
