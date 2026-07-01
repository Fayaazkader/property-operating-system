import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const entityId = url.searchParams.get("entity") || "";
  const leaseStatus = url.searchParams.get("status") || "Active";

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

  let query = supabase.from("leases").select("*").eq("lease_status", leaseStatus).order("monthly_rental", { ascending: false });
  if (entityId) query = query.eq("owner_entity_id", entityId);

  const { data: leases } = await query;
  if (!leases || leases.length === 0) return NextResponse.json({ leases: [], summary: {} });

  const leaseIds = leases.map(l => l.id);
  const tenantIds = leases.map(l => l.tenant_id).filter(Boolean);
  const propertyIds = leases.map(l => l.property_id).filter(Boolean);

  const { data: tenants } = await supabase.from("tenants").select("id, tenant_name, code, company_registration, industry, risk_rating").in("id", tenantIds);
  const { data: properties } = await supabase.from("properties").select("id, property_name, property_code, property_type, province, total_gla_sqm").in("id", propertyIds);
  const { data: entities } = await supabase.from("entities").select("id, entity_name").in("id", leases.map(l => l.owner_entity_id).filter(Boolean));
  const { data: charges } = await supabase.from("charges").select("lease_id, amount_incl_vat, created_at").in("lease_id", leaseIds);
  const { data: payments } = await supabase.from("bank_transactions").select("matched_tenant_id, transaction_amount").in("matched_tenant_id", tenantIds);
  const { data: units } = await supabase.from("units").select("id, gla_sqm, property_id, current_tenant_name").in("property_id", propertyIds);

  const tenantMap = new Map(tenants?.map(t => [t.id, t]) || []);
  const propertyMap = new Map(properties?.map(p => [p.id, p]) || []);
  const entityMap = new Map(entities?.map(e => [e.id, e]) || []);

  const now = new Date();
  const enriched = leases.map(l => {
    const tenant = tenantMap.get(l.tenant_id);
    const property = propertyMap.get(l.property_id);
    const entity = entityMap.get(l.owner_entity_id);

    const leaseCharges = charges?.filter(c => c.lease_id === l.id) || [];
    const totalCharges = leaseCharges.reduce((s, c) => s + (c.amount_incl_vat || 0), 0);
    const leasePayments = payments?.filter(p => p.matched_tenant_id === l.tenant_id) || [];
    const totalPayments = leasePayments.reduce((s, p) => s + Math.abs(p.transaction_amount || 0), 0);

    const expiry = l.lease_end_date ? new Date(l.lease_end_date) : null;
    const daysRemaining = expiry ? Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
    const annualValue = (l.monthly_rental || 0) * 12;

    const propertyUnits = units?.filter(u => u.property_id === l.property_id) || [];
    const tenantUnit = propertyUnits.find(u => u.current_tenant_name === l.tenant_name);
    const gla = tenantUnit?.gla_sqm || property?.total_gla_sqm || 0;
    const rentalRate = gla > 0 ? (l.monthly_rental || 0) / gla : 0;

    return {
      lease_id: l.lease_id,
      tenant_code: tenant?.code || "—",
      tenant_name: l.tenant_name,
      registered_name: tenant?.company_registration || l.tenant_name,
      tenant_industry: tenant?.industry || "—",
      tenant_risk: tenant?.risk_rating || "—",
      entity_name: entity?.entity_name || "—",
      property_code: property?.property_code || "—",
      property_name: property?.property_name || "—",
      property_type: property?.property_type || "—",
      region: property?.province || "—",
      unit_gla: gla,
      lease_type: l.lease_type || "—",
      lease_start: l.lease_start_date,
      lease_expiry: l.lease_end_date,
      days_remaining: daysRemaining,
      monthly_rental: l.monthly_rental || 0,
      rental_rate_per_sqm: Math.round(rentalRate),
      escalation_pct: l.escalation_percent || 0,
      parking_bays: l.parking_bays || 0,
      deposit_held: l.deposit_amount || 0,
      annual_value: annualValue,
      remaining_value: daysRemaining ? Math.round((l.monthly_rental || 0) * (daysRemaining / 30)) : 0,
      total_charges: totalCharges,
      total_payments: totalPayments,
      arrears: totalCharges - totalPayments,
      status: l.lease_status,
    };
  });

  const totalMonthly = enriched.reduce((s, l) => s + l.monthly_rental, 0);
  const totalAnnual = totalMonthly * 12;
  const totalArrears = enriched.reduce((s, l) => s + l.arrears, 0);
  const totalGLA = enriched.reduce((s, l) => s + l.unit_gla, 0);
  const avgRate = totalGLA > 0 ? Math.round(totalMonthly / totalGLA) : 0;
  const totalDeposits = enriched.reduce((s, l) => s + l.deposit_held, 0);
  const avgWALE = enriched.length > 0 ? Math.round(enriched.reduce((s, l) => s + (l.days_remaining || 0), 0) / enriched.length / 30) : 0;
  const topTenant = enriched.reduce((max, l) => l.monthly_rental > (max?.monthly_rental || 0) ? l : max, enriched[0]);

  return NextResponse.json({
    leases: enriched,
    summary: {
      totalLeases: enriched.length,
      totalMonthlyRental: totalMonthly,
      totalAnnualRental: totalAnnual,
      totalArrears,
      totalGLA,
      averageRatePerSqm: avgRate,
      totalDeposits,
      waleMonths: avgWALE,
      topTenant: topTenant?.tenant_name || "—",
      concentrationPct: topTenant && totalMonthly > 0 ? Math.round((topTenant.monthly_rental / totalMonthly) * 100) : 0,
    },
  });
}
