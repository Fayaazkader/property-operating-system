import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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

  // Property
  const { data: property } = await supabase.from("properties").select("*").eq("id", id).single();
  if (!property) return NextResponse.json({ error: "Property not found" }, { status: 404 });

  // Entity
  const { data: entity } = await supabase.from("entities").select("entity_name").eq("id", property.entity_id).single();

  // Active leases
  const { data: leases } = await supabase
    .from("leases")
    .select("id, lease_id, tenant_id, lease_status, lease_start_date, lease_end_date, monthly_rental, tenants(tenant_name)")
    .eq("property_id", id)
    .order("lease_start_date", { ascending: false });

  const activeLeases = leases?.filter(l => l.lease_status === 'Active') || [];
  const occupied = activeLeases.length;
  const totalUnits = property.number_of_units || activeLeases.length;
  const vacant = totalUnits - occupied;
  const occupancy = totalUnits > 0 ? Math.round((occupied / totalUnits) * 100) : 0;
  const monthlyRevenue = activeLeases.reduce((s, l) => s + (l.monthly_rental || 0), 0);

  // Charges & arrears
  const { data: charges } = await supabase.from("charges").select("*").in("lease_id", leases?.map(l => l.id) || []).order("created_at", { ascending: false }).limit(50);
  const { data: payments } = await supabase
    .from("bank_transactions")
    .select("*")
    .in("matched_tenant_id", activeLeases.map(l => l.tenant_id).filter(Boolean))
    .order("transaction_date", { ascending: false }).limit(50);

  const totalCharges = charges?.reduce((s: number, c: any) => s + (c.amount_incl_vat || 0), 0) || 0;
  const totalPayments = payments?.reduce((s: number, p: any) => s + Math.abs(p.transaction_amount || 0), 0) || 0;
  const arrears = totalCharges - totalPayments;

  // Expiring leases
  const now = new Date();
  const expiring = activeLeases.filter(l => {
    const end = l.lease_end_date ? new Date(l.lease_end_date) : null;
    return end && Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) <= 90;
  });

  // Communications
  const tenantIds = activeLeases.map(l => l.tenant_id).filter(Boolean);
  const { data: communications } = await supabase
    .from("communications")
    .select("*")
    .in("tenant_id", tenantIds)
    .order("created_at", { ascending: false })
    .limit(30);

  // Units (if table exists)
  const { data: units } = await supabase.from("units").select("*").eq("property_id", id).order("unit_number");

  return NextResponse.json({
    property: { ...property, entity_name: entity?.entity_name || "Unknown" },
    leases: leases || [],
    activeLeases,
    units: units || [],
    financial: {
      totalCharges, totalPayments, arrears, monthlyRevenue,
      charges: charges || [], payments: payments || [],
    },
    occupancy: { totalUnits, occupied, vacant, occupancy },
    expiring: expiring || [],
    communications: communications || [],
  });
}
