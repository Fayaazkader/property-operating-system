import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  try {
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

    // Get entity from user access
    const { data: accessRows } = await serviceClient
      .from('user_entity_access')
      .select('entity_id')
      .eq('user_id', user.id)
      .limit(1);

    if (!accessRows?.length) return NextResponse.json({ error: "No entity access" }, { status: 403 });

    const entityId = accessRows[0].entity_id;
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category') || undefined;

    const { data: suppliers } = await serviceClient
      .from('suppliers')
      .select('*')
      .eq('entity_id', entityId);

    return NextResponse.json({ success: true, data: suppliers || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json();

    if (!body.name) {
      return NextResponse.json({ error: "Supplier name is required" }, { status: 400 });
    }

    // Get entity from user access or from body
    let entityId = body.entityId;
    if (!entityId) {
      const { data: accessRows } = await serviceClient
        .from('user_entity_access')
        .select('entity_id')
        .eq('user_id', user.id)
        .limit(1);
      if (!accessRows?.length) return NextResponse.json({ error: "No entity access" }, { status: 403 });
      entityId = accessRows[0].entity_id;
    }

    // Auto-generate supplier code
    const { count } = await serviceClient
      .from('suppliers')
      .select('*', { count: 'exact', head: true })
      .eq('entity_id', entityId);
    const supplierCode = `SUP-${String((count || 0) + 1).padStart(3, '0')}`;

    const { data, error } = await serviceClient
      .from('suppliers')
      .insert({
        supplier_name: body.name,
        supplier_code: supplierCode,
        entity_id: entityId,
        trading_name: body.trading_name,
        registered_name: body.registered_name,
        registration_number: body.registration_number,
        vat_number: body.vat_number,
        contact_person: body.contact_person,
        email: body.email,
        phone: body.phone,
        whatsapp_number: body.whatsapp_number,
        address: body.address,
        bank_name: body.bank_name,
        bank_account: body.bank_account,
        bank_branch: body.bank_branch,
        payment_method: body.payment_method,
        payment_terms: body.payment_terms_days,
        status: 'active',
      })
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
