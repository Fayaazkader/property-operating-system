import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const search = url.searchParams.get("search") || "";
  const page = parseInt(url.searchParams.get("page") || "0");
  const pageSize = parseInt(url.searchParams.get("pageSize") || "50");

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

  let baseQuery = supabase.from("properties").select("id, property_name, property_code, city, province, property_type, property_status, entity_id, total_gla_sqm, number_of_units, operational_region", { count: "exact" });
  if (search) baseQuery = baseQuery.or(`property_name.ilike.%${search}%,property_code.ilike.%${search}%,city.ilike.%${search}%,province.ilike.%${search}%,operational_region.ilike.%${search}%`);

  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data: propertiesData, count } = await baseQuery.range(from, to).order("property_name");

  if (!propertiesData) return NextResponse.json({ properties: [], total: 0, summary: { total: 0, occupied: 0, vacant: 0, revenue: 0 } });

  const propertyIds = propertiesData.map(p => p.id);

  const { data: entities } = await supabase.from("entities").select("id, entity_name").in("id", propertiesData.map(p => p.entity_id));

  const { data: leasesData } = await supabase.from("leases").select("property_id, lease_status, monthly_rental, lease_end_date").in("property_id", propertyIds).eq("lease_status", "Active");

  const { data: chargesData } = await supabase.from("charges").select("property_id, amount_incl_vat").in("property_id", propertyIds);

  const now = new Date();
  let totalOccupied = 0, totalVacant = 0, totalRevenue = 0;

  const enriched = propertiesData.map((p: any) => {
    const propertyLeases = leasesData?.filter(l => l.property_id === p.id) || [];
    const activeLeases = propertyLeases.filter(l => l.lease_status === 'Active');
    const occupied = activeLeases.length;
    const vacant = 0; // Will calculate properly when units table is populated
    const revenue = activeLeases.reduce((s, l) => s + (l.monthly_rental || 0), 0);
    const occupancy = (p.number_of_units || 0) > 0 ? Math.round((occupied / p.number_of_units) * 100) : 0;

    totalOccupied += occupied;
    totalVacant += vacant;
    totalRevenue += revenue;

    const propertyCharges = chargesData?.filter(c => c.property_id === p.id).reduce((s: number, c: any) => s + (c.amount_incl_vat || 0), 0) || 0;
    const arrears = propertyCharges;

    const expiring = propertyLeases.filter(l => {
      const end = (l as any).lease_end_date ? new Date((l as any).lease_end_date) : null;
      return end && Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) <= 90;
    }).length;

    return {
      id: p.id,
      property_code: p.property_code || null,
      property_name: p.property_name,
      city: p.city,
      province: p.province,
      property_type: p.property_type,
      property_status: p.property_status,
      entity_id: p.entity_id,
      entity_name: entities?.find(e => e.id === p.entity_id)?.entity_name || "Unknown",
      portfolio: p.operational_region || null,
      gla: p.total_gla_sqm,
      units: p.number_of_units,
      occupied,
      vacant,
      occupancy,
      revenue,
      arrears,
      expiring,
    };
  });

  return NextResponse.json({
    properties: enriched,
    total: count || 0,
    page,
    pageSize,
    summary: {
      total: count || 0,
      occupied: totalOccupied,
      vacant: totalVacant,
      revenue: totalRevenue,
    },
  });
}
