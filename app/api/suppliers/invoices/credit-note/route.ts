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

  const { invoiceId, reason } = await request.json();
  if (!invoiceId) return NextResponse.json({ error: "invoiceId required" }, { status: 400 });

  try {
    // Fetch original invoice
    const { data: original } = await serviceClient
      .from('supplier_invoices_new')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (!original) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    // ENTITY AUTHORIZATION
    const { data: access } = await serviceClient
      .from('user_entity_access')
      .select('entity_id')
      .eq('user_id', user.id)
      .eq('entity_id', original.entity_id)
      .single();

    if (!access) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    // Only posted invoices can be credited
    if (original.lifecycle_status !== 'posted') {
      return NextResponse.json({ error: "Only posted invoices can be credited" }, { status: 409 });
    }

    // Check if already fully credited
    if (original.credit_status === 'fully_credited') {
      return NextResponse.json({ error: "Invoice already fully credited" }, { status: 409 });
    }

    // Create credit note record
    const { data: creditNote, error } = await serviceClient
      .from('supplier_invoices_new')
      .insert({
        entity_id: original.entity_id,
        supplier_id: original.supplier_id,
        supplier_account_id: original.supplier_account_id,
        invoice_number: `CN-${original.invoice_number}`,
        total_amount: -(original.total_amount || 0),
        vat_amount: -(original.vat_amount || 0),
        subtotal: -(original.subtotal || 0),
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: null,
        description: `Credit note for ${original.invoice_number}${reason ? ` — ${reason}` : ''}`,
        lifecycle_status: 'posted',
        status: 'credit_note',
        source: 'credit_note',
        duplicate_of: original.id,
        created_by: user.id,
      })
      .select('*')
      .single();

    if (error) throw error;

    // Copy line items as negative reversals
    const { data: originalLines } = await serviceClient
      .from('supplier_invoice_lines')
      .select('*')
      .eq('invoice_id', invoiceId);

    if (originalLines?.length) {
      const creditLines = originalLines.map((line: any) => ({
        invoice_id: creditNote.id,
        property_id: line.property_id,
        gl_code: line.gl_code,
        description: line.description || `Credit for ${original.invoice_number}`,
        amount: -(line.amount || 0),
        vat_code: line.vat_code,
        vat_rate: line.vat_rate,
        vat_amount: -(line.vat_amount || 0),
        total: -(line.total || 0),
        cost_centre: line.cost_centre,
      }));

      await serviceClient.from('supplier_invoice_lines').insert(creditLines);
    }

    // Update original invoice — keep posted, mark as credited
    await serviceClient
      .from('supplier_invoices_new')
      .update({
        credit_status: 'fully_credited',
        credit_note_id: creditNote.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId);

    return NextResponse.json({ success: true, creditNote });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
