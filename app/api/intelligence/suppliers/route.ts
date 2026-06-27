import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const search = url.searchParams.get("search") || "";
  const filter = url.searchParams.get("filter") || "all";
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

  let query = supabase.from("suppliers").select("*", { count: "exact" }).order("supplier_name");
  if (search) query = query.or(`supplier_name.ilike.%${search}%,email.ilike.%${search}%,industry.ilike.%${search}%`);

  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, count } = await query.range(from, to);

  // Summary
  const { data: allSuppliers } = await supabase.from("suppliers").select("id, industry");
  const total = allSuppliers?.length || 0;
  const contractors = allSuppliers?.filter(s => s.industry === 'Security' || s.industry === 'Cleaning' || s.industry === 'Maintenance' || s.industry === 'Engineering').length || 0;
  const utilities = allSuppliers?.filter(s => s.industry === 'Utilities').length || 0;
  const professionalServices = allSuppliers?.filter(s => s.industry === 'Legal' || s.industry === 'Financial Services' || s.industry === 'Insurance').length || 0;

  return NextResponse.json({
    suppliers: data || [],
    total: count || 0,
    page, pageSize,
    summary: { total, contractors, utilities, professionalServices },
  });
}
