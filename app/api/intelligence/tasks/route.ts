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

  let query = supabase
    .from("tasks")
    .select("*", { count: "exact" })
    .order("created_date", { ascending: false });

  if (search) {
    query = query.or(
      `task_id.ilike.%${search}%,task_type.ilike.%${search}%,tenant_name.ilike.%${search}%,property_name.ilike.%${search}%,assigned_to.ilike.%${search}%`
    );
  }

  const now = new Date();
  const today = now.toISOString().split("T")[0];

  if (filter === "overdue") {
    query = query.lt("due_date", today).neq("task_status", "Completed");
  } else if (filter === "today") {
    query = query.eq("due_date", today).neq("task_status", "Completed");
  } else if (filter === "week") {
    query = query
      .gte("due_date", today)
      .lte(
        "due_date",
        new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0]
      )
      .neq("task_status", "Completed");
  } else if (filter === "completed") {
    query = query.eq("task_status", "Completed");
  } else if (filter === "high") {
    query = query.eq("priority", "High").neq("task_status", "Completed");
  } else if (filter === "pending") {
    query = query.neq("task_status", "Completed");
  }

  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, count, error } = await query.range(from, to);

if (error) {
  console.error("[Tasks API]", error);

  return NextResponse.json(
    {
      error: "Failed to load tasks",
      tasks: [],
      total: 0,
      page,
      pageSize,
      summary: {
        total: 0,
        open: 0,
        overdue: 0,
        today: 0,
        high: 0,
      },
    },
    { status: 500 }
  );
}

  const { data: allTasks } = await supabase
    .from("tasks")
    .select("task_status, due_date, priority");

  const total = allTasks?.length || 0;
  const openCount =
    allTasks?.filter((task) => task.task_status !== "Completed").length || 0;
  const overdueCount =
    allTasks?.filter(
      (task) =>
        task.due_date &&
        new Date(task.due_date) < now &&
        task.task_status !== "Completed"
    ).length || 0;
  const todayCount =
    allTasks?.filter(
      (task) =>
        task.due_date &&
        new Date(task.due_date).toISOString().split("T")[0] === today &&
        task.task_status !== "Completed"
    ).length || 0;
  const highCount =
    allTasks?.filter(
      (task) => task.priority === "High" && task.task_status !== "Completed"
    ).length || 0;

  return NextResponse.json({
    tasks: data || [],
    total: count || 0,
    page, pageSize,
    summary: { total, open: openCount, overdue: overdueCount, today: todayCount, high: highCount },
  });
}
