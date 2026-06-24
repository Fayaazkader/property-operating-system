import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") || "";

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

  const lowerQuery = query.toLowerCase();

  // Who owes the most?
  if (lowerQuery.includes("owe") || lowerQuery.includes("arrear") || lowerQuery.includes("outstanding")) {
    const { data: charges } = await supabase.from("charges").select("tenant_id, amount_incl_vat, tenants(tenant_name)").order("amount_incl_vat", { ascending: false }).limit(5);
    const { data: payments } = await supabase.from("bank_transactions").select("matched_tenant_id, transaction_amount");

    const paymentMap = new Map();
    payments?.forEach((p: any) => {
      const prev = paymentMap.get(p.matched_tenant_id) || 0;
      paymentMap.set(p.matched_tenant_id, prev + Math.abs(p.transaction_amount || 0));
    });

    const results = (charges || []).map((c: any) => ({
      tenant: (c as any).tenants?.tenant_name || "Unknown",
      balance: (c.amount_incl_vat || 0) - (paymentMap.get(c.tenant_id) || 0),
    })).filter((r: any) => r.balance > 0).sort((a: any, b: any) => b.balance - a.balance).slice(0, 5);

    return NextResponse.json({ type: "top_arrears", label: "Top Arrears", results });
  }

  // What hasn't been billed?
  if (lowerQuery.includes("unbilled") || lowerQuery.includes("not been billed") || lowerQuery.includes("what hasn't")) {
    const { data: leases } = await supabase.from("leases").select("id, tenant_name, property_name").eq("lease_status", "Active");
    const { data: charges } = await supabase.from("charges").select("lease_id").eq("billing_period", "August 2026");

    const chargedLeaseIds = new Set(charges?.map(c => c.lease_id));
    const unbilled = (leases || []).filter(l => !chargedLeaseIds.has(l.id)).slice(0, 5);

    return NextResponse.json({
      type: "unbilled_leases",
      label: `Unbilled Leases`,
      results: unbilled.map(l => ({ lease: l.id, tenant: l.tenant_name, property: l.property_name })),
      count: (leases || []).filter(l => !chargedLeaseIds.has(l.id)).length,
    });
  }

  // Which leases need attention?
  if (lowerQuery.includes("attention") || lowerQuery.includes("need") || lowerQuery.includes("which lease")) {
    const { data: expiring } = await supabase.from("leases").select("id, tenant_name, lease_end_date").eq("lease_status", "Active").lte("lease_end_date", new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]).order("lease_end_date").limit(5);

    const { data: noRules } = await supabase.from("leases").select("id, tenant_name").eq("lease_status", "Active");
    const { data: rules } = await supabase.from("billing_rules").select("lease_id").eq("status", "active");
    const ruleLeaseIds = new Set(rules?.map(r => r.lease_id));
    const missingRules = (noRules || []).filter(l => !ruleLeaseIds.has(l.id)).slice(0, 3);

    return NextResponse.json({
      type: "lease_attention",
      label: "Leases Requiring Attention",
      expiring: (expiring || []).map(l => ({ tenant: l.tenant_name, expiry: l.lease_end_date })),
      missingRules: missingRules.map(l => ({ tenant: l.tenant_name })),
    });
  }

  return NextResponse.json({ type: "unknown", message: "Try: who owes the most, what hasn't been billed, which leases need attention" });
}
