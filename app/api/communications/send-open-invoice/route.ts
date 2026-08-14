import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sgMail from "@sendgrid/mail";
import twilio from "twilio";
import { buildRevenueContext } from '@/lib/revenue/revenue-context-builder';
import { generateInvoicePDF } from "@/lib/revenue/invoice-pdf-generator";
import { uploadAndGetSignedUrl } from "@/lib/communications/signed-urls";
import { logCommunication } from "@/lib/communications/communication-log";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const accessToken = authHeader.slice(7);

  // Auth client — validates the token
  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: { user } } = await authClient.auth.getUser(accessToken);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Service client — trusted server-side data access
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) console.error("NO SERVICE ROLE KEY");

  const { tenant_id, lease_id, entity_id, stmt_period_id, fin_period_id } = await request.json();
  if (!tenant_id || !entity_id || !stmt_period_id || !fin_period_id) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    // RBAC check with service client
    const { data: access } = await serviceClient
      .from('user_entity_access')
      .select('entity_id')
      .eq('user_id', user.id)
      .eq('entity_id', entity_id)
      .single();
    if (!access) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    // Build revenue context with service client
    const worksheet = await buildRevenueContext(entity_id, null, stmt_period_id, fin_period_id, serviceClient);
    const tenantWorksheet = worksheet.tenants?.find((t: any) => t.tenantId === tenant_id);
    if (!tenantWorksheet) return NextResponse.json({ error: "Tenant not found in worksheet" }, { status: 422 });
    if (!tenantWorksheet.charges?.length) return NextResponse.json({ error: "No billable charges" }, { status: 422 });

    const { data: tenant } = await serviceClient.from('tenants').select('tenant_name, email, whatsapp_number').eq('id', tenant_id).single();
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

       const entityResult = await serviceClient.from('entities').select('entity_name, address, bank_details').eq('id', entity_id).single();
    console.error("Entity result:", entityResult);
    const { data: entity } = entityResult;
    if (!entity?.entity_name) return NextResponse.json({ error: "Entity not found" }, { status: 404 });

    const lineItems = tenantWorksheet.charges.map((c: any) => ({ description: c.description, amount: c.amount || 0 }));
    const subTotal = tenantWorksheet.charges.reduce((s: number, c: any) => s + (c.amount || 0), 0);
    const vatTotal = tenantWorksheet.charges.reduce((s: number, c: any) => s + (c.vatAmount || 0), 0);
    const total = subTotal + vatTotal;

    const dueDate = worksheet.periodEnd;
    if (!dueDate) return NextResponse.json({ error: "Due date not available" }, { status: 422 });

    const invoiceNumber = `INV-${worksheet.periodName.replace(/\s/g, '-')}-${tenant_id.substring(0, 6).toUpperCase()}`;

    const pdfBytes = await generateInvoicePDF({
      invoice_number: invoiceNumber,
      tenant_name: tenant.tenant_name,
      property_name: tenantWorksheet.property_name,
      period: worksheet.periodName,
      due_date: dueDate,
      line_items: lineItems,
      sub_total: subTotal,
      vat_amount: vatTotal,
      total,
      entity_name: entity.entity_name,
      entity_address: entity.address || '',
      bank_details: entity.bank_details || '',
      reference: tenantWorksheet.leaseRef || invoiceNumber,
    });

    const signedUrl = await uploadAndGetSignedUrl('documents', `invoices/${invoiceNumber}.pdf`, pdfBytes, 'application/pdf', 86400);

    const results: any = { email: null, whatsapp: null };
    const messagePreview = `Invoice ${invoiceNumber} - R${total.toLocaleString()}`;

    if (tenant.email) {
      try {
        sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');
        await sgMail.send({
          to: tenant.email,
          from: { email: "hello@assetflow.africa", name: "AssetFlow" },
          subject: `Invoice ${invoiceNumber} - ${tenantWorksheet.property_name}`,
          html: `<h2>AssetFlow</h2><p>Dear ${tenant.tenant_name},</p><p>Your invoice for <strong>${worksheet.periodName}</strong> is attached.</p><p style="font-size:18px">Total: <strong>R${total.toLocaleString()}</strong></p>`,
          attachments: [{ filename: `Invoice-${invoiceNumber}.pdf`, content: Buffer.from(pdfBytes).toString('base64'), type: 'application/pdf', disposition: 'attachment' }],
        });
        results.email = { success: true };
        await logCommunication({ entity_id, tenant_id, channel: 'email', direction: 'outbound', template: 'invoice_ready', subject: `Invoice ${invoiceNumber}`, message_preview: messagePreview, document_url: signedUrl, status: 'sent', sent_by: user.email || user.id });
      } catch (err: any) { results.email = { success: false, error: err.message }; }
    }

    if (tenant.whatsapp_number && process.env.TWILIO_CONTENT_SID_INVOICE) {
      try {
        const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
        const msg = await client.messages.create({
          from: process.env.TWILIO_WHATSAPP_FROM,
          to: `whatsapp:${tenant.whatsapp_number.replace(/\D/g, "")}`,
          contentSid: process.env.TWILIO_CONTENT_SID_INVOICE,
          contentVariables: JSON.stringify({
            '1': tenant.tenant_name,
            '2': invoiceNumber,
            '3': `R${total.toLocaleString()}`,
            '4': dueDate,
            '5': signedUrl,
          }),
        });
        results.whatsapp = { success: true, messageId: msg.sid };
        await logCommunication({ entity_id, tenant_id, channel: 'whatsapp', direction: 'outbound', template: 'invoice_ready', message_preview: messagePreview, document_url: signedUrl, status: 'sent', provider_message_id: msg.sid, sent_by: user.email || user.id });
      } catch (err: any) { results.whatsapp = { success: false, error: err.message }; }
    }

    const attempted = [!!tenant.email, !!(tenant.whatsapp_number && process.env.TWILIO_CONTENT_SID_INVOICE)].filter(Boolean).length;
    if (attempted === 0) return NextResponse.json({ success: false, status: 'no_channels', error: 'No delivery channels', results }, { status: 422 });

    const successful = [results.email?.success, results.whatsapp?.success].filter(Boolean).length;
    const overallStatus = successful === attempted ? 'sent' : successful > 0 ? 'partial' : 'failed';

    return NextResponse.json({ success: overallStatus !== 'failed', status: overallStatus, results });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
