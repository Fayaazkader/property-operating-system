import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messageId, status } = body;

    if (!messageId) {
      return NextResponse.json({ error: "Missing messageId" }, { status: 400 });
    }

    const updateData: any = {};
    if (status === "delivered") updateData.delivered_at = new Date().toISOString();
    if (status === "read") updateData.read_at = new Date().toISOString();
    updateData.status = status;

    await supabase
      .from("communications")
      .update(updateData)
      .eq("external_message_id", messageId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}