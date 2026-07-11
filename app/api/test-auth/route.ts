import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    console.log('Session:', session);
    console.log('Error:', error);
    
    return NextResponse.json({
      hasSession: !!session,
      user: session?.user?.email || null,
      error: error?.message || null
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
