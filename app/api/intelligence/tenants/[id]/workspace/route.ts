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

  const { data: tenant } = await supabase.from("tenants").select("*").eq("id", id).single();
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  // Active lease
  const { data: lease } = await supabase.from("leases").select("*, properties(property_name, property_code, property_type, city)").eq("tenant_id", id).order("lease_start_date", { ascending: false }).limit(1).single();

  // All leases
  const { data: allLeases } = await supabase.from("leases").select("id, lease_id, lease_status, lease_start_date, lease_end_date, monthly_rental, deposit_amount, escalation_percent, parking_bays, parking_rate, properties(property_name)").eq("tenant_id", id).order("lease_start_date", { ascending: false });

  // Billing rules
  const { data: billingRules } = await supabase.from("billing_rules").select("*").in("lease_id", allLeases?.map(l => l.id) || []).eq("status", "active");

  // Financial
  const { data: charges } = await supabase.from("charges").select("*").eq("tenant_id", id).order("created_at", { ascending: false }).limit(50);
  const { data: payments } = await supabase.from("bank_transactions").select("*").eq("matched_tenant_id", id).order("transaction_date", { ascending: false }).limit(50);
  const { data: invoices } = await supabase.from("invoices").select("*").eq("tenant_id", id).order("created_at", { ascending: false }).limit(10);

  const totalCharges = charges?.reduce((s: number, c: any) => s + (c.amount_incl_vat || 0), 0) || 0;
  const totalPayments = payments?.reduce((s: number, p: any) => s + Math.abs(p.transaction_amount || 0), 0) || 0;

  // Statement history
  const { data: statements } = await supabase.from("communications").select("*").eq("tenant_id", id).eq("event_type", "statement_available").order("created_at", { ascending: false }).limit(12);

  // All communications
  const { data: communications } = await supabase.from("communications").select("*").eq("tenant_id", id).order("created_at", { ascending: false }).limit(50);

  // Tasks
  const { data: tasks } = await supabase.from("tasks").select("*").eq("tenant_id", id).order("created_at", { ascending: false }).limit(10);

  // Aging analysis
  const now = new Date();
  let current = 0, days30 = 0, days60 = 0, days90 = 0, days120 = 0;
  charges?.forEach((c: any) => {
    const age = Math.ceil((now.getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24));
    const unpaid = (c.amount_incl_vat || 0) - (payments?.filter((p: any) => p.matched_invoice_id === c.id).reduce((s: number, p: any) => s + Math.abs(p.transaction_amount || 0), 0) || 0);
    if (unpaid <= 0) return;
    if (age <= 30) current += unpaid;
    else if (age <= 60) days30 += unpaid;
    else if (age <= 90) days60 += unpaid;
    else if (age <= 120) days90 += unpaid;
    else days120 += unpaid;
  });

  // Deposit ledger
  const depositReceived = allLeases?.reduce((s: number, l: any) => s + (l.deposit_amount || 0), 0) || 0;

  return NextResponse.json({
    tenant,
    lease: lease || null,
    allLeases: allLeases || [],
    billingRules: billingRules || [],
    financial: {
      totalCharges, totalPayments, balance: totalCharges - totalPayments,
      charges: charges || [], payments: payments || [], invoices: invoices || [],
      depositReceived,
    },
    statements: statements || [],
    aging: { current, days30, days60, days90, days120 },
    communications: communications || [],
    tasks: tasks || [],
  });
}
