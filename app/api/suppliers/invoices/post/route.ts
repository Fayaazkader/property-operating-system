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

  const { invoiceId } = await request.json();
  if (!invoiceId) return NextResponse.json({ error: "invoiceId required" }, { status: 400 });

  try {
    // Fetch invoice
    const { data: invoice } = await serviceClient
      .from('supplier_invoices_new')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    // ENTITY AUTHORIZATION
    const { data: access } = await serviceClient
      .from('user_entity_access')
      .select('entity_id')
      .eq('user_id', user.id)
      .eq('entity_id', invoice.entity_id)
      .single();

    if (!access) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    // ACCOUNTING VALIDATION
    if (invoice.lifecycle_status === 'posted') {
      return NextResponse.json({ error: "Invoice already posted" }, { status: 409 });
    }

    if (invoice.lifecycle_status === 'credit_note') {
      return NextResponse.json({ error: "Cannot post a credit note" }, { status: 409 });
    }

    // Fetch line items
    const { data: lines } = await serviceClient
      .from('supplier_invoice_lines')
      .select('*')
      .eq('invoice_id', invoiceId);

    if (!lines?.length) {
      return NextResponse.json({ error: "No line items — cannot post" }, { status: 422 });
    }

    // Validate each line has GL code
    const missingGl = lines.filter(l => !l.gl_code);
    if (missingGl.length > 0) {
      return NextResponse.json({ error: `${missingGl.length} line(s) missing GL code` }, { status: 422 });
    }

    // Validate totals reconcile
    const lineTotalExcl = lines.reduce((sum, l) => sum + (l.amount || 0), 0);
    const lineTotalVat = lines.reduce((sum, l) => sum + (l.vat_amount || 0), 0);
    const lineTotalIncl = lineTotalExcl + lineTotalVat;

    if (Math.abs(lineTotalIncl - (invoice.total_amount || 0)) > 1) {
      return NextResponse.json({
        error: `Line items total R${lineTotalIncl.toFixed(2)} does not match invoice total R${(invoice.total_amount || 0).toFixed(2)}`
      }, { status: 422 });
    }

    // Post the invoice
    const { data: posted, error } = await serviceClient
      .from('supplier_invoices_new')
      .update({
        lifecycle_status: 'posted',
        status: 'posted',
        posted_by: user.id,
        posted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, invoice: posted });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
