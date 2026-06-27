import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const search = url.searchParams.get("search") || "";
  const channel = url.searchParams.get("channel") || "all";
  const status = url.searchParams.get("status") || "all";
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

  let query = supabase.from("communications").select("*", { count: "exact" }).order("created_at", { ascending: false });

  if (channel !== "all") query = query.eq("channel", channel);
  if (status !== "all") query = query.eq("status", status);
  if (search) query = query.or(`message_body.ilike.%${search}%,event_type.ilike.%${search}%,source_id.ilike.%${search}%`);

  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, count } = await query.range(from, to);

  // Summary counts
  const { data: allData } = await supabase.from("communications").select("channel, status");
  const total = allData?.length || 0;
  const delivered = allData?.filter(c => c.status === 'delivered' || c.status === 'read').length || 0;
  const read = allData?.filter(c => c.status === 'read').length || 0;
  const failed = allData?.filter(c => c.status === 'failed').length || 0;
  const pending = allData?.filter(c => c.status === 'queued' || c.status === 'sent').length || 0;
  const whatsapp = allData?.filter(c => c.channel === 'whatsapp').length || 0;
  const email = allData?.filter(c => c.channel === 'email').length || 0;
  const whatsappDelivered = allData?.filter(c => c.channel === 'whatsapp' && (c.status === 'delivered' || c.status === 'read')).length || 0;
  const whatsappRead = allData?.filter(c => c.channel === 'whatsapp' && c.status === 'read').length || 0;
  const whatsappFailed = allData?.filter(c => c.channel === 'whatsapp' && c.status === 'failed').length || 0;
  const emailDelivered = allData?.filter(c => c.channel === 'email' && (c.status === 'delivered' || c.status === 'read')).length || 0;
  const emailRead = allData?.filter(c => c.channel === 'email' && c.status === 'read').length || 0;
  const emailFailed = allData?.filter(c => c.channel === 'email' && c.status === 'failed').length || 0;

  return NextResponse.json({
    communications: data || [],
    total: count || 0,
    page,
    pageSize,
    summary: {
      total, delivered, read, failed, pending,
      deliveryRate: total > 0 ? Math.round((delivered / total) * 100) : 100,
      readRate: delivered > 0 ? Math.round((read / delivered) * 100) : 0,
      whatsapp: { total: whatsapp, delivered: whatsappDelivered, read: whatsappRead, failed: whatsappFailed },
      email: { total: email, delivered: emailDelivered, read: emailRead, failed: emailFailed },
    },
  });
}
