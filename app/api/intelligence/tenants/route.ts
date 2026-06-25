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

  // Build query
  let baseQuery = supabase.from("tenants").select("id, tenant_name, code, company_registration, email, entity_id, whatsapp_enabled", { count: "exact" });
  if (search) baseQuery = baseQuery.or(`tenant_name.ilike.%${search}%,code.ilike.%${search}%,company_registration.ilike.%${search}%,email.ilike.%${search}%`);

  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data: tenantsData, count } = await baseQuery.range(from, to).order("tenant_name");

  if (!tenantsData) return NextResponse.json({ tenants: [], total: 0, summary: { active: 0, arrears: 0, expiring: 0, archived: 0 } });

  const tenantIds = tenantsData.map(t => t.id);

  const { data: leasesData } = await supabase
    .from("leases")
    .select("id, lease_id, lease_status, lease_end_date, monthly_rental, tenant_id, property_id, properties(property_name)")
    .in("tenant_id", tenantIds);

  const { data: chargesData } = await supabase.from("charges").select("tenant_id, amount_incl_vat").in("tenant_id", tenantIds);
  const { data: paymentsData } = await supabase.from("bank_transactions").select("matched_tenant_id, transaction_amount").in("matched_tenant_id", tenantIds);
  const { data: entities } = await supabase.from("entities").select("id, entity_name");

  // Summary from page data
  const now = new Date();
  let activeCount = 0, arrearsCount = 0, expiringCount = 0, archivedCount = 0;

  tenantsData.forEach((t: any) => {
    const lease = leasesData?.find((l: any) => l.tenant_id === t.id);
    if (!lease || lease.lease_status === 'Expired') { archivedCount++; return; }
    activeCount++;
    const charges = chargesData?.filter((c: any) => c.tenant_id === t.id).reduce((s: number, c: any) => s + (c.amount_incl_vat || 0), 0) || 0;
    const payments = paymentsData?.filter((p: any) => p.matched_tenant_id === t.id).reduce((s: number, p: any) => s + Math.abs(p.transaction_amount || 0), 0) || 0;
    if (charges - payments > 0) arrearsCount++;
    const expiry = lease?.lease_end_date ? new Date(lease.lease_end_date) : null;
    if (expiry && Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) <= 90) expiringCount++;
  });

  // Enrich
  const enriched = tenantsData.map((t: any) => {
    const lease = leasesData?.find((l: any) => l.tenant_id === t.id) || null;
    const tenantCharges = chargesData?.filter((c: any) => c.tenant_id === t.id) || [];
    const tenantPayments = paymentsData?.filter((p: any) => p.matched_tenant_id === t.id) || [];
    const totalCharges = tenantCharges.reduce((s: number, c: any) => s + (c.amount_incl_vat || 0), 0);
    const totalPayments = tenantPayments.reduce((s: number, p: any) => s + Math.abs(p.transaction_amount || 0), 0);
    const expiry = lease?.lease_end_date ? new Date(lease.lease_end_date) : null;
    const daysToExpiry = expiry ? Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 999;

    return {
      id: t.id, tenant_name: t.tenant_name, code: t.code || null,
      company_registration: t.company_registration || null, email: t.email,
      entity_id: t.entity_id, entity_name: entities?.find(e => e.id === t.entity_id)?.entity_name || "Unknown",
      property_id: lease?.property_id || null, property_name: (lease as any)?.properties?.property_name || null,
      current_lease: lease?.lease_id || null, lease_status: lease?.lease_status || null,
      monthly_rental: lease?.monthly_rental || null, balance: totalCharges - totalPayments,
      days_to_expiry: daysToExpiry, whatsapp_enabled: t.whatsapp_enabled,
    };
  });

  return NextResponse.json({
    tenants: enriched,
    total: count || 0,
    page,
    pageSize,
    summary: { active: activeCount, arrears: arrearsCount, expiring: expiringCount, archived: archivedCount },
  });
}
