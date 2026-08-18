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
    entityId, supplierId, supplierAccountId, accountNumber, accountPropertyId,
    invoiceNumber, invoiceDate, dueDate, description,
    totalAmount, vatAmount, subtotal, documentId, extractedFields,
    lineItems = [], overrideDuplicate = false, overrideCalculation = false,
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
    // DUPLICATE CHECK
    const { data: existing } = await serviceClient
      .from('supplier_invoices_new')
      .select('id, invoice_number, total_amount')
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

    // CALCULATION VALIDATION
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

    // CREATE OR RESOLVE SUPPLIER ACCOUNT
    let resolvedAccountId = supplierAccountId || null;
    if (!resolvedAccountId && accountNumber) {
      // Check if account exists
      const { data: existingAccount } = await serviceClient
        .from('supplier_accounts')
        .select('id')
        .eq('supplier_id', supplierId)
        .eq('account_number', accountNumber)
        .maybeSingle();

      if (existingAccount) {
        resolvedAccountId = existingAccount.id;
      } else {
        // Create account
        const { data: newAccount } = await serviceClient
          .from('supplier_accounts')
          .insert({
            supplier_id: supplierId,
            entity_id: entityId,
            property_id: accountPropertyId || null,
            account_number: accountNumber,
            account_name: accountNumber,
          })
          .select('id')
          .single();
        if (newAccount) resolvedAccountId = newAccount.id;
      }
    }

    // INSERT INVOICE
    const { data: invoice, error } = await serviceClient
      .from('supplier_invoices_new')
      .insert({
        entity_id: entityId,
        supplier_id: supplierId,
        supplier_account_id: resolvedAccountId,
        invoice_number: invoiceNumber,
        total_amount: numTotal,
        vat_amount: numVat,
        subtotal: numSubtotal,
        invoice_date: invoiceDate || null,
        due_date: dueDate || null,
        description: description || null,
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

    // INSERT LINE ITEMS
    if (lineItems.length > 0) {
      const lineRows = lineItems.map((item: any) => ({
        invoice_id: invoice.id,
        property_id: item.property_id || null,
        gl_code: item.gl_code || null,
        description: item.description || '',
        amount: item.amount_excl || 0,
        vat_code: item.vat_rate ? `VAT${item.vat_rate}` : null,
        vat_rate: item.vat_rate || 0,
        vat_amount: item.vat_amount || 0,
        total: item.amount_incl || 0,
        cost_centre: item.cost_centre || null,
      }));

      const { error: lineError } = await serviceClient.from('supplier_invoice_lines').insert(lineRows);
      if (lineError) throw lineError;
    }

    // UPDATE DOCUMENT REVIEW
    if (documentId) {
      await serviceClient
        .from('document_reviews')
        .update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq('document_id', documentId);
    }

    return NextResponse.json({ success: true, invoice, lineItemCount: lineItems.length });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
