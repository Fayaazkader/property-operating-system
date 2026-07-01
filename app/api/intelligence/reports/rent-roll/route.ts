import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const entityId = url.searchParams.get("entity") || "";
  const propertyId = url.searchParams.get("property") || "";
  const region = url.searchParams.get("region") || "";
  const leaseStatus = url.searchParams.get("status") || "Active";
  const dateAsAt = url.searchParams.get("date") || new Date().toISOString().split("T")[0];

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

  let query = supabase
    .from("leases")
    .select(`
      id, lease_id, tenant_name, monthly_rental, deposit_amount, escalation_percent,
      lease_start_date, lease_end_date, lease_status, lease_type, parking_bays, billing_frequency,
      properties!inner(property_name, property_code, property_type, city, province, total_gla_sqm, entity_id),
      tenants!inner(id, tenant_name, code, company_registration, industry, risk_rating),
      entities!inner(entity_name)
    `)
    .eq("lease_status", leaseStatus)
    .order("monthly_rental", { ascending: false });

  if (entityId) query = query.eq("owner_entity_id", entityId);
  if (propertyId) query = query.eq("property_id", propertyId);

  const { data: leases } = await query;
  if (!leases) return NextResponse.json({ leases: [], summary: {} });

  const leaseIds = leases.map(l => l.id);
  const tenantIds = leases.map(l => (l as any).tenants?.id).filter(Boolean);

  const { data: charges } = await supabase.from("charges").select("lease_id, amount_incl_vat").in("lease_id", leaseIds);
  const { data: payments } = await supabase.from("bank_transactions").select("matched_tenant_id, transaction_amount, transaction_date").in("matched_tenant_id", tenantIds);
 const { data: units } = await supabase.from("units").select("id, gla_sqm, property_id, current_tenant_name").in("property_id", leases.map((l: any) => l.property_id));

  const now = new Date(dateAsAt);
  const enriched = leases.map(l => {
    const leaseCharges = charges?.filter(c => c.lease_id === l.id) || [];
    const totalCharges = leaseCharges.reduce((s, c) => s + (c.amount_incl_vat || 0), 0);
    const leasePayments = payments?.filter(p => p.matched_tenant_id === (l as any).tenants?.id) || [];
    const totalPayments = leasePayments.reduce((s, p) => s + Math.abs(p.transaction_amount || 0), 0);

    // Aging
    let current = 0, d30 = 0, d60 = 0, d90 = 0, d120 = 0;
    leaseCharges.forEach((c: any) => {
      const age = Math.ceil((now.getTime() - new Date(c.created_at || c.billing_period).getTime()) / (1000 * 60 * 60 * 24));
      const unpaid = (c.amount_incl_vat || 0);
      if (age <= 30) current += unpaid;
      else if (age <= 60) d30 += unpaid;
      else if (age <= 90) d60 += unpaid;
      else if (age <= 120) d90 += unpaid;
      else d120 += unpaid;
    });

    const expiry = l.lease_end_date ? new Date(l.lease_end_date) : null;
    const daysRemaining = expiry ? Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
    const annualValue = (l.monthly_rental || 0) * 12;
    const remainingValue = daysRemaining ? (l.monthly_rental || 0) * (daysRemaining / 30) : 0;

    const propertyUnits = units?.filter((u: any) => u.property_id === (l as any).property_id) || [];
    const tenantUnit = propertyUnits.find(u => u.current_tenant_name === l.tenant_name);
    const gla = tenantUnit?.gla_sqm || (l as any).properties?.total_gla_sqm || 0;
    const rentalRate = gla > 0 ? (l.monthly_rental || 0) / gla : 0;

    return {
      lease_id: l.lease_id,
      tenant_code: (l as any).tenants?.code || "—",
      tenant_name: l.tenant_name,
      registered_name: (l as any).tenants?.company_registration || l.tenant_name,
      tenant_industry: (l as any).tenants?.industry || "—",
      tenant_risk: (l as any).tenants?.risk_rating || "—",
      entity_name: (l as any).entities?.entity_name || "—",
      property_code: (l as any).properties?.property_code || "—",
      property_name: (l as any).properties?.property_name || "—",
      property_type: (l as any).properties?.property_type || "—",
      region: (l as any).properties?.province || "—",
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
      remaining_value: Math.round(remainingValue),
      total_charges: totalCharges,
      total_payments: totalPayments,
      arrears: totalCharges - totalPayments,
      aging: { current, d30, d60, d90, d120 },
      status: l.lease_status,
    };
  });

  // Summary KPIs
  const totalMonthly = enriched.reduce((s, l) => s + l.monthly_rental, 0);
  const totalAnnual = totalMonthly * 12;
  const totalArrears = enriched.reduce((s, l) => s + l.arrears, 0);
  const totalGLA = enriched.reduce((s, l) => s + l.unit_gla, 0);
  const avgRate = totalGLA > 0 ? Math.round(totalMonthly / totalGLA) : 0;
  const totalDeposits = enriched.reduce((s, l) => s + l.deposit_held, 0);
  const avgWALE = enriched.length > 0 ? Math.round(enriched.reduce((s, l) => s + (l.days_remaining || 0), 0) / enriched.length / 30) : 0;
  const topTenant = enriched.reduce((max, l) => l.monthly_rental > (max?.monthly_rental || 0) ? l : max, enriched[0]);
  const concentrationPct = topTenant && totalMonthly > 0 ? Math.round((topTenant.monthly_rental / totalMonthly) * 100) : 0;

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
      concentrationPct,
    },
  });
}
