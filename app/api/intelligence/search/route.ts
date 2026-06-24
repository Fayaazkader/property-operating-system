import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") || "";
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

  // Get user entity scope
  const { data: { user } } = await supabase.auth.getUser();
  let entityIds: string[] = [];
  let isAdmin = false;

  if (user) {
    const { data: profile } = await supabase.from("profiles").select("platform_role").eq("id", user.id).single();
    isAdmin = profile?.platform_role === "platform_admin";

    if (!isAdmin) {
      const { data: access } = await supabase.from("user_entity_access").select("entity_id").eq("user_id", user.id);
      entityIds = access?.map(a => a.entity_id) || [];
    }
  }

  const [tenants, properties, leases, statements] = await Promise.all([
    searchTenants(supabase, query, isAdmin ? [] : entityIds),
    searchProperties(supabase, query, isAdmin ? [] : entityIds),
    searchLeases(supabase, query, isAdmin ? [] : entityIds),
    searchStatements(supabase, query),
  ]);

  const commands: any[] = [];
  const lowerQuery = query.toLowerCase();
  if ("unallocated receipts".includes(lowerQuery) || lowerQuery.includes("unallocated")) {
    commands.push({ type: "command", label: "Unallocated Receipts", sublabel: "Open Cash Book", href: "/financials/cash-book" });
  }
  if ("billing exceptions".includes(lowerQuery) || lowerQuery.includes("exception")) {
    commands.push({ type: "command", label: "Billing Exceptions", sublabel: "Open Revenue Ops", href: "/financials/revenue" });
  }
  if ("expiring leases".includes(lowerQuery) || lowerQuery.includes("expir")) {
    commands.push({ type: "command", label: "Expiring Leases", sublabel: "View leases expiring soon", href: "/leases" });
  }
  if ("arrears".includes(lowerQuery) || lowerQuery.includes("owe")) {
    commands.push({ type: "command", label: "Arrears Report", sublabel: "View outstanding balances", href: "/tenants" });
  }

  const results = [...commands, ...tenants, ...properties, ...leases, ...statements].slice(0, 10);
  return NextResponse.json({ results });
}

async function searchTenants(supabase: any, query: string, entityIds: string[]) {
  let q = supabase.from("tenants").select("id, tenant_name, email").ilike("tenant_name", `%${query}%`).limit(5);
  if (entityIds.length > 0) q = q.in("entity_id", entityIds);
  const { data } = await q;
  return (data || []).map((t: any) => ({ type: "tenant", id: t.id, label: t.tenant_name, sublabel: t.email, href: `/tenants` }));
}

async function searchProperties(supabase: any, query: string, entityIds: string[]) {
  let q = supabase.from("properties").select("id, property_name, city").or(`property_name.ilike.%${query}%,city.ilike.%${query}%`).limit(5);
  if (entityIds.length > 0) q = q.in("entity_id", entityIds);
  const { data } = await q;
  return (data || []).map((p: any) => ({ type: "property", id: p.id, label: p.property_name, sublabel: p.city, href: `/properties` }));
}

async function searchLeases(supabase: any, query: string, entityIds: string[]) {
  let q = supabase.from("leases").select("id, lease_id, tenant_name, property_name").or(`lease_id.ilike.%${query}%,tenant_name.ilike.%${query}%,property_name.ilike.%${query}%`).limit(5);
  if (entityIds.length > 0) q = q.in("owner_entity_id", entityIds);
  const { data } = await q;
  return (data || []).map((l: any) => ({ type: "lease", id: l.id, label: l.lease_id, sublabel: `${l.tenant_name} · ${l.property_name}`, href: `/leases/${l.id}` }));
}

async function searchStatements(supabase: any, query: string) {
  const { data } = await supabase.from("communications").select("source_id, tenant_id").eq("event_type", "statement_available").ilike("source_id", `%${query}%`).limit(5);
  return (data || []).map((c: any) => ({ type: "statement", label: c.source_id?.replace("INV-", "Statement: "), href: `/financials/revenue` }));
}
