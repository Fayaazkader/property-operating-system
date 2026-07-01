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

  let leaseQuery = supabase.from("leases").select("id, lease_id, tenant_name, tenant_id, property_id, owner_entity_id, monthly_rental, lease_status").eq("lease_status", "Active");
  if (entityId) leaseQuery = leaseQuery.eq("owner_entity_id", entityId);
  if (propertyId) leaseQuery = leaseQuery.eq("property_id", propertyId);

  const { data: leases } = await leaseQuery;
  if (!leases || leases.length === 0) return NextResponse.json({ arrears: [], summary: {} });

  const leaseIds = leases.map(l => l.id);
  const tenantIds = leases.map(l => l.tenant_id).filter(Boolean);
  const propertyIds = leases.map(l => l.property_id).filter(Boolean);

  const { data: tenants } = await supabase.from("tenants").select("id, tenant_name, code").in("id", tenantIds);
  const { data: properties } = await supabase.from("properties").select("id, property_name").in("id", propertyIds);
  const { data: entities } = await supabase.from("entities").select("id, entity_name").in("id", leases.map(l => l.owner_entity_id).filter(Boolean));
  const { data: charges } = await supabase.from("charges").select("lease_id, amount_incl_vat, created_at, billing_period").in("lease_id", leaseIds).order("created_at", { ascending: false });
  const { data: payments } = await supabase.from("bank_transactions").select("matched_tenant_id, transaction_amount, transaction_date").in("matched_tenant_id", tenantIds);

  const tenantMap = new Map(tenants?.map(t => [t.id, t]) || []);
  const propertyMap = new Map(properties?.map(p => [p.id, p]) || []);
  const entityMap = new Map(entities?.map(e => [e.id, e]) || []);

  const now = new Date();
  const arrearsList: any[] = [];
  let totalCurrent = 0, total30 = 0, total60 = 0, total90 = 0, total120 = 0, totalOutstanding = 0;

  leases.forEach(l => {
    const leaseCharges = charges?.filter(c => c.lease_id === l.id) || [];
    const totalCharges = leaseCharges.reduce((s, c) => s + (c.amount_incl_vat || 0), 0);
    const leasePayments = payments?.filter(p => p.matched_tenant_id === l.tenant_id) || [];
    const totalPayments = leasePayments.reduce((s, p) => s + Math.abs(p.transaction_amount || 0), 0);
    const balance = totalCharges - totalPayments;

    if (balance <= 0) return;

    let current = 0, d30 = 0, d60 = 0, d90 = 0, d120 = 0;
    leaseCharges.forEach((c: any) => {
      const chargeDate = c.created_at ? new Date(c.created_at) : now;
      const age = Math.ceil((now.getTime() - chargeDate.getTime()) / (1000 * 60 * 60 * 24));
      const unpaid = (c.amount_incl_vat || 0);
      if (age <= 30) current += unpaid;
      else if (age <= 60) d30 += unpaid;
      else if (age <= 90) d60 += unpaid;
      else if (age <= 120) d90 += unpaid;
      else d120 += unpaid;
    });

    totalCurrent += current;
    total30 += d30;
    total60 += d60;
    total90 += d90;
    total120 += d120;
    totalOutstanding += balance;

    arrearsList.push({
      tenant_name: l.tenant_name,
      tenant_code: tenantMap.get(l.tenant_id)?.code || "—",
      property_name: propertyMap.get(l.property_id)?.property_name || "—",
      entity_name: entityMap.get(l.owner_entity_id)?.entity_name || "—",
      lease_id: l.lease_id,
      monthly_rental: l.monthly_rental || 0,
      balance,
      aging: { current, d30, d60, d90, d120 },
    });
  });

  arrearsList.sort((a, b) => b.balance - a.balance);

  return NextResponse.json({
    arrears: arrearsList,
    summary: { totalArrears: totalOutstanding, totalCurrent, total30, total60, total90, total120, accountsInArrears: arrearsList.length },
  });
}
