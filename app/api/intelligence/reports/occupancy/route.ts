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
  if (!properties) return NextResponse.json({ occupancy: [], summary: {}, segmentation: {}, risks: [] });

  const propertyIds = properties.map(p => p.id);
  const entityIds = properties.map(p => p.entity_id).filter(Boolean);

  const { data: units } = await supabase.from("units").select("property_id, occupancy_status, current_rental_rate, gla_sqm").in("property_id", propertyIds);
  const { data: entities } = await supabase.from("entities").select("id, entity_name").in("id", entityIds);
  const { data: leases } = await supabase.from("leases").select("property_id, lease_status, monthly_rental, lease_end_date").in("property_id", propertyIds).eq("lease_status", "Active");

  const entityMap = new Map(entities?.map(e => [e.id, e]) || []);

  // Property-level occupancy
  const occupancyData = properties.map(p => {
    const propertyUnits = units?.filter(u => u.property_id === p.id) || [];
    const totalUnits = propertyUnits.length || p.number_of_units || 0;
    const occupied = propertyUnits.filter(u => u.occupancy_status === 'Occupied').length;
    const vacant = totalUnits - occupied;
    const occupancyPct = totalUnits > 0 ? Math.round((occupied / totalUnits) * 100) : 0;
    const totalGLA = propertyUnits.reduce((s, u) => s + (u.gla_sqm || 0), 0) || p.total_gla_sqm || 0;
    const vacantGLA = propertyUnits.filter(u => u.occupancy_status !== 'Occupied').reduce((s, u) => s + (u.gla_sqm || 0), 0);
    const estimatedVacancyCost = propertyUnits.filter(u => u.occupancy_status === 'Vacant').reduce((s, u) => s + (u.current_rental_rate || 0), 0);
    const annualExposure = estimatedVacancyCost * 12;
    const propertyLeases = leases?.filter(l => l.property_id === p.id) || [];
    const monthlyRevenue = propertyLeases.reduce((s, l) => s + (l.monthly_rental || 0), 0);
    const expiringCount = propertyLeases.filter(l => l.lease_end_date && new Date(l.lease_end_date) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)).length;

    return {
      property_name: p.property_name, property_code: p.property_code, property_type: p.property_type,
      region: p.province, portfolio: p.operational_region || "—",
      entity_name: entityMap.get(p.entity_id)?.entity_name || "—",
      total_units: totalUnits, occupied, vacant, occupancy_pct: occupancyPct,
      total_gla: totalGLA, vacant_gla: vacantGLA,
      monthly_revenue: monthlyRevenue,
      estimated_vacancy_cost: estimatedVacancyCost,
      annual_exposure: annualExposure,
      expiring_leases: expiringCount,
      below_target: occupancyPct < 85,
    };
  });

  // Segmentation by property type
  const segmentation: Record<string, { total: number; occupied: number; units: number; gla: number }> = {};
  occupancyData.forEach(p => {
    const type = p.property_type || "Other";
    if (!segmentation[type]) segmentation[type] = { total: 0, occupied: 0, units: 0, gla: 0 };
    segmentation[type].total += p.total_units;
    segmentation[type].occupied += p.occupied;
    segmentation[type].units += 1;
    segmentation[type].gla += p.total_gla;
  });

  // Risk items
  const risks: string[] = [];
  occupancyData.filter(p => p.vacant > 0 && p.estimated_vacancy_cost > 50000).forEach(p => {
    risks.push(`${p.property_name}: ${p.vacant} vacant, R${Math.round(p.estimated_vacancy_cost/1000)}k/month exposure`);
  });
  const totalVacancyCost = occupancyData.reduce((s, p) => s + p.estimated_vacancy_cost, 0);
  if (totalVacancyCost > 200000) risks.push(`Portfolio vacancy cost exceeds R${Math.round(totalVacancyCost/1000)}k/month`);
  const belowTarget = occupancyData.filter(p => p.below_target);
  if (belowTarget.length > 0) risks.push(`${belowTarget.length} properties below 85% occupancy target`);

  // Summary
  const totalUnits = occupancyData.reduce((s, p) => s + p.total_units, 0);
  const totalOccupied = occupancyData.reduce((s, p) => s + p.occupied, 0);
  const totalVacant = occupancyData.reduce((s, p) => s + p.vacant, 0);
  const totalGLA = occupancyData.reduce((s, p) => s + p.total_gla, 0);
  const totalVacantGLA = occupancyData.reduce((s, p) => s + p.vacant_gla, 0);

  return NextResponse.json({
    occupancy: occupancyData,
    segmentation,
    risks,
    summary: {
      totalProperties: occupancyData.length,
      totalUnits, totalOccupied, totalVacant,
      occupancyPct: totalUnits > 0 ? Math.round((totalOccupied / totalUnits) * 100) : 0,
      totalGLA, totalVacantGLA,
      totalVacancyCost,
      annualExposure: totalVacancyCost * 12,
      belowTarget: belowTarget.length,
      vacancyPct: totalUnits > 0 ? Math.round((totalVacant / totalUnits) * 100) : 0,
    },
  });
}
