import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { processDocument } from "@/lib/document-intelligence/engine";

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

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const tenantId = formData.get('tenantId') as string | null;
  const fileName = formData.get('fileName') as string | null;
  const mimeType = formData.get('mimeType') as string | null;

  if (!file || !fileName || !mimeType) {
    return NextResponse.json({ error: "file, fileName, and mimeType are required" }, { status: 400 });
  }

  if (tenantId) {
    const { data: tenant } = await serviceClient
      .from('tenants')
      .select('entity_id')
      .eq('id', tenantId)
      .single();

    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

    const { data: access } = await serviceClient
      .from('user_entity_access')
      .select('entity_id')
      .eq('user_id', user.id)
      .eq('entity_id', tenant.entity_id)
      .single();

    if (!access) return NextResponse.json({ error: "Access denied" }, { status: 403 });
  } else {
    const { data: accessRows } = await serviceClient
      .from('user_entity_access')
      .select('entity_id')
      .eq('user_id', user.id)
      .limit(1);

    if (!accessRows?.length) return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const documentId = crypto.randomUUID();
    const storagePath = `documents/intake/${documentId}-${fileName}`;
    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await serviceClient.storage
      .from('documents')
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Document storage upload failed: ${uploadError.message}`);
    }

    const result = await processDocument(
      fileBuffer,
      fileName,
      mimeType,
      tenantId || undefined,
      { documentId },
      serviceClient
    );

    await serviceClient.from('document_reviews').insert({
      document_id: documentId,
      document_type: result.documentType,
      status: 'pending',
      extracted_fields: result.extractedFields,
    });

    return NextResponse.json({ success: true, result, documentId });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
