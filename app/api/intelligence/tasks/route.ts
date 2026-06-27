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

  let query = supabase.from("tasks").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);

  const now = new Date();
  const today = now.toISOString().split("T")[0];

  if (filter === "overdue") query = query.lt("due_date", today).neq("status", "completed");
  else if (filter === "today") query = query.eq("due_date", today).neq("status", "completed");
  else if (filter === "week") query = query.gte("due_date", today).lte("due_date", new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]).neq("status", "completed");
  else if (filter === "completed") query = query.eq("status", "completed");
  else if (filter === "high") query = query.eq("priority", "high").neq("status", "completed");
  else if (filter === "pending") query = query.neq("status", "completed");

  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, count } = await query.range(from, to);

  const { data: allTasks } = await supabase.from("tasks").select("status, due_date, priority");
  const total = allTasks?.length || 0;
  const openCount = allTasks?.filter(t => t.status !== 'completed').length || 0;
  const overdueCount = allTasks?.filter(t => t.due_date && t.due_date < today && t.status !== 'completed').length || 0;
  const todayCount = allTasks?.filter(t => t.due_date === today && t.status !== 'completed').length || 0;
  const highCount = allTasks?.filter(t => t.priority === 'high' && t.status !== 'completed').length || 0;

  return NextResponse.json({
    tasks: data || [],
    total: count || 0,
    page, pageSize,
    summary: { total, open: openCount, overdue: overdueCount, today: todayCount, high: highCount },
  });
}
