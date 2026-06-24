import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  const { query, resultCount, resultClicked } = await request.json();
  if (!query) return NextResponse.json({ ok: true });

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

  const { data: { user } } = await supabase.auth.getUser();

  await supabase.from("search_activity").insert({
    user_id: user?.id || null,
    query,
    result_count: resultCount || 0,
    result_clicked: resultClicked || null,
  });

  return NextResponse.json({ ok: true });
}
