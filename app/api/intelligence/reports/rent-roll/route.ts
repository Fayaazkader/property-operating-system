import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
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

  const { data: leases } = await supabase
    .from("leases")
    .select(`
      id, lease_id, tenant_name, monthly_rental, deposit_amount, escalation_percent,
      lease_start_date, lease_end_date, lease_status, parking_bays, billing_frequency,
      properties(property_name, property_code),
      tenants!inner(entity_id, tenant_name)
    `)
    .eq("lease_status", "Active")
    .order("monthly_rental", { ascending: false });

  const { data: charges } = await supabase.from("charges").select("lease_id, amount_incl_vat").in("lease_id", leases?.map(l => l.id) || []);
  const { data: payments } = await supabase.from("bank_transactions").select("matched_tenant_id, transaction_amount").in("matched_tenant_id", leases?.map(l => (l as any).tenants?.entity_id).filter(Boolean) || []);

  const enriched = (leases || []).map(l => {
    const leaseCharges = charges?.filter(c => c.lease_id === l.id).reduce((s, c) => s + (c.amount_incl_vat || 0), 0) || 0;
    const leasePayments = payments?.filter(p => p.matched_tenant_id === (l as any).tenants?.entity_id).reduce((s, p) => s + Math.abs(p.transaction_amount || 0), 0) || 0;
    return {
      ...l,
      property_name: (l as any).properties?.property_name,
      property_code: (l as any).properties?.property_code,
      total_charges: leaseCharges,
      total_payments: leasePayments,
      arrears: leaseCharges - leasePayments,
    };
  });

  const totalRental = enriched.reduce((s, l) => s + (l.monthly_rental || 0), 0);
  const totalArrears = enriched.reduce((s, l) => s + l.arrears, 0);
  const totalDeposits = enriched.reduce((s, l) => s + (l.deposit_amount || 0), 0);

  return NextResponse.json({
    leases: enriched,
    summary: { totalLeases: enriched.length, totalRental, totalArrears, totalDeposits },
  });
}
