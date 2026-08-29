import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.toLowerCase() || "";
  if (query.length < 2) return NextResponse.json({ results: [] });

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

  // Natural language intent detection
  let intent = "search";
  let filters: any = {};
  
  if (query.includes("expiring") || query.includes("expiry")) {
    intent = "expiring_leases";
    const days = query.includes("90") ? 90 : query.includes("180") ? 180 : query.includes("30") ? 30 : 90;
    filters.expiryDays = days;
  } else if (query.includes("owing") || query.includes("arrears") || query.includes("outstanding") || query.includes("owe")) {
    intent = "arrears";
  } else if (query.includes("vacant") || query.includes("vacancy") || query.includes("unoccupied")) {
    intent = "vacant";
  } else if (query.includes("invoice") || query.includes("invoiced")) {
    intent = "invoices";
  } else if (query.includes("statement")) {
    intent = "statements";
  }

  const results: any[] = [];
// Intent-based results
if (intent === "expiring_leases") {
  const days = filters.expiryDays || 90;
  const now = new Date();
  const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  
  const { data: expiringLeases } = await supabase.from("leases")
    .select("id, lease_id, tenant_name, property_name, monthly_rental, lease_end_date, lease_status")
    .eq("lease_status", "Active")
    .lte("lease_end_date", cutoff)
    .gte("lease_end_date", now.toISOString().split("T")[0])
    .order("lease_end_date")
    .limit(10);
  
  expiringLeases?.forEach(l => results.push({
    type: "lease", id: l.id, title: l.lease_id, 
    subtitle: `${l.tenant_name} · ${l.property_name}`,
    meta: `Expires ${new Date(l.lease_end_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`,
    href: "/tenants", icon: "FileText"
  }));
  
  return NextResponse.json({ results: results.slice(0, 15), intent, query });
}

if (intent === "arrears") {
  // Get tenants with outstanding balances
  const { data: allCharges } = await supabase.from("charges").select("tenant_id, amount_incl_vat");
  const { data: allPayments } = await supabase.from("bank_transactions").select("matched_tenant_id, transaction_amount");
  
  const balanceMap = new Map<string, number>();
  allCharges?.forEach(c => balanceMap.set(c.tenant_id, (balanceMap.get(c.tenant_id) || 0) + (c.amount_incl_vat || 0)));
  allPayments?.forEach(p => balanceMap.set(p.matched_tenant_id, (balanceMap.get(p.matched_tenant_id) || 0) - Math.abs(p.transaction_amount || 0)));
  
  const arrearsTenants = Array.from(balanceMap.entries())
    .filter(([_, balance]) => balance > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  const { data: arrearsData } = await supabase.from("tenants")
    .select("id, tenant_name, code").in("id", arrearsTenants.map(([id]) => id));
  
  arrearsData?.forEach(t => {
    const balance = balanceMap.get(t.id) || 0;
    results.push({
      type: "tenant", id: t.id, title: t.tenant_name, subtitle: t.code,
      meta: `R${balance.toLocaleString()} outstanding`,
      href: `/tenants/${t.id}`, icon: "TrendingDown"
    });
  });
  
  return NextResponse.json({ results: results.slice(0, 15), intent, query });
}
  // 1. Tenant search
  const { data: tenants } = await supabase.from("tenants").select("id, tenant_name, code, email, whatsapp_enabled")
    .or(`tenant_name.ilike.%${query}%,code.ilike.%${query}%,email.ilike.%${query}%`).limit(5);
  tenants?.forEach(t => results.push({ type: "tenant", id: t.id, title: t.tenant_name, subtitle: t.code, meta: t.email, href: `/tenants/${t.id}`, icon: "Users" }));

  // 2. Property search
  const { data: properties } = await supabase.from("properties").select("id, property_name, property_code, city, property_type")
    .or(`property_name.ilike.%${query}%,property_code.ilike.%${query}%,city.ilike.%${query}%`).limit(5);
  properties?.forEach(p => results.push({ type: "property", id: p.id, title: p.property_name, subtitle: p.city, meta: p.property_type, href: `/properties/${p.id}`, icon: "Building2" }));

  // 3. Lease search
  const { data: leases } = await supabase.from("leases").select("id, lease_id, tenant_name, property_name, monthly_rental, lease_status")
    .or(`lease_id.ilike.%${query}%,tenant_name.ilike.%${query}%`).limit(5);
  leases?.forEach(l => results.push({ type: "lease", id: l.id, title: l.lease_id, subtitle: `${l.tenant_name} · ${l.property_name}`, meta: l.lease_status, href: `/tenants`, icon: "FileText" }));

  // 4. Communications search
  const { data: communications } = await supabase.from("communications").select("id, event_type, channel, status, source_id, tenant_id, created_at")
    .or(`source_id.ilike.%${query}%,event_type.ilike.%${query}%`).order("created_at", { ascending: false }).limit(5);
  communications?.forEach(c => results.push({ type: "communication", id: c.id, title: c.event_type?.replace(/_/g, " "), subtitle: c.source_id, meta: `${c.channel} · ${c.status}`, href: `/communications`, icon: "MessageSquare" }));

  // 5. Invoice search
  const { data: invoices } = await supabase.from("invoices").select("id, invoice_number, tenant_name, total_amount, payment_status")
    .or(`invoice_number.ilike.%${query}%,tenant_name.ilike.%${query}%`).limit(5);
  invoices?.forEach(i => results.push({ type: "invoice", id: i.id, title: i.invoice_number, subtitle: i.tenant_name, meta: `R${i.total_amount?.toLocaleString() || 0}`, href: `/financials/revenue`, icon: "Receipt" }));

  // 6. Statement search
  const { data: statements } = await supabase.from("communications").select("id, source_id, tenant_id, created_at")
    .eq("event_type", "statement_available").ilike("source_id", `%${query}%`).order("created_at", { ascending: false }).limit(5);
  statements?.forEach(s => results.push({ type: "statement", id: s.id, title: s.source_id?.replace("INV-", "Statement: "), subtitle: new Date(s.created_at).toLocaleDateString("en-ZA"), meta: "Statement", href: `/financials/revenue`, icon: "Receipt" }));

  // 7. Task search
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, task_id, task_type, tenant_name, property_name, task_status, due_date, priority")
    .or(`task_id.ilike.%${query}%,task_type.ilike.%${query}%,tenant_name.ilike.%${query}%,property_name.ilike.%${query}%`)
    .limit(5);
  tasks?.forEach((task) => results.push({
    type: "task",
    id: task.id,
    title: task.task_type || task.task_id,
    subtitle: [task.task_id, task.tenant_name, task.property_name, task.due_date ? `Due: ${task.due_date}` : ""].filter(Boolean).join(" · "),
    meta: task.priority || task.task_status,
    href: "/tasks",
    icon: "CheckSquare",
  }));

  // Sort: intent-based results first, then by relevance
  const prioritized = results.sort((a, b) => {
    if (intent === "expiring_leases" && a.type === "lease") return -1;
    if (intent === "arrears" && a.type === "tenant") return -1;
    if (intent === "invoices" && a.type === "invoice") return -1;
    if (intent === "statements" && a.type === "statement") return -1;
    return 0;
  });

  return NextResponse.json({ results: prioritized.slice(0, 15), intent, query });
}
