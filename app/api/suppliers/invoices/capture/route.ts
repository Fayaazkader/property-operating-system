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

  const {
    entityId, supplierId, invoiceNumber, invoiceDate, dueDate,
    totalAmount, vatAmount, subtotal, documentId, extractedFields,
    overrideDuplicate = false, overrideCalculation = false,
  } = await request.json();

  if (!entityId || !supplierId || !invoiceNumber || !totalAmount) {
    return NextResponse.json({ error: "entityId, supplierId, invoiceNumber, and totalAmount are required" }, { status: 400 });
  }

  // RBAC
  const { data: access } = await serviceClient
    .from('user_entity_access')
    .select('entity_id')
    .eq('user_id', user.id)
    .eq('entity_id', entityId)
    .single();

  if (!access) return NextResponse.json({ error: "Access denied" }, { status: 403 });

  try {
    // SERVER-SIDE DUPLICATE CHECK
    const { data: existing } = await serviceClient
      .from('supplier_invoices_new')
      .select('id, invoice_number, total_amount, invoice_date')
      .eq('entity_id', entityId)
      .eq('invoice_number', invoiceNumber)
      .maybeSingle();

    if (existing && !overrideDuplicate) {
      return NextResponse.json({
        error: 'DUPLICATE_INVOICE',
        message: `Invoice ${invoiceNumber} already exists`,
        existingInvoice: existing,
      }, { status: 409 });
    }

    // SERVER-SIDE CALCULATION VALIDATION
    const numSubtotal = parseFloat(subtotal) || 0;
    const numVat = parseFloat(vatAmount) || 0;
    const numTotal = parseFloat(totalAmount) || 0;
    const calculatedTotal = numSubtotal + numVat;

    if (numSubtotal > 0 && numVat > 0 && Math.abs(calculatedTotal - numTotal) > 1 && !overrideCalculation) {
      return NextResponse.json({
        error: 'CALCULATION_MISMATCH',
        message: `Subtotal ${numSubtotal} + VAT ${numVat} = ${calculatedTotal}, but invoice total is ${numTotal}`,
        calculatedTotal,
      }, { status: 422 });
    }

    const { data, error } = await serviceClient
      .from('supplier_invoices_new')
      .insert({
        entity_id: entityId,
        supplier_id: supplierId,
        invoice_number: invoiceNumber,
        total_amount: numTotal,
        vat_amount: numVat,
        subtotal: numSubtotal,
        invoice_date: invoiceDate || null,
        due_date: dueDate || null,
        lifecycle_status: 'pending',
        source: 'ocr',
        document_id: documentId || null,
        extracted_fields: extractedFields || {},
        override_duplicate: overrideDuplicate,
        override_calculation: overrideCalculation,
      })
      .select('*')
      .single();

    if (error) throw error;

    // Update document review to approved
    if (documentId) {
      await serviceClient
        .from('document_reviews')
        .update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq('document_id', documentId);
    }

    return NextResponse.json({ success: true, invoice: data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
