import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const accessToken = authHeader.slice(7);

  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: { user } } = await authClient.auth.getUser(accessToken);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { documentId, status, reason, extractedFields } = await request.json();

  if (!documentId || !status || !['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: "Invalid review" }, { status: 400 });
  }

  try {
    // Unique constraint ensures one review per document
    const { data, error } = await serviceClient
      .from('document_reviews')
      .upsert({
        document_id: documentId,
        status,
        reviewed_by: user.id,
        review_reason: reason,
        extracted_fields: extractedFields,
        reviewed_at: new Date().toISOString(),
      }, { onConflict: 'document_id' })
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, review: data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
