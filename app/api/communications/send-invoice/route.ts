import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import sgMail from "@sendgrid/mail";
import twilio from "twilio";
import { generateInvoicePDF } from "@/lib/revenue/services/invoice-pdf.service";
import { uploadAndGetSignedUrl } from "@/lib/communications/signed-urls";
import { logCommunication } from "@/lib/communications/communication-log";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: () => cookieStore }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { invoice_id, send_email, send_whatsapp } = await request.json();

  // 1. Fetch invoice from database — the single source of truth
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, tenant:tenant_id(*), lease:lease_id(*), lines:invoice_lines(*)')
    .eq('id', invoice_id)
    .single();

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  // 2. Validate required fields
  if (!(invoice as any).due_date) {
    return NextResponse.json({ error: "Invoice has no due date — cannot send" }, { status: 422 });
  }

  // 3. RBAC
  const { data: access } = await supabase
    .from('user_entity_access')
    .select('entity_id')
    .eq('user_id', user.id)
    .eq('entity_id', (invoice as any).entity_id)
    .single();

  if (!access) return NextResponse.json({ error: "Access denied" }, { status: 403 });

  const entityId = (invoice as any).entity_id;
  const tenantId = (invoice as any).tenant_id;
  const tenant = (invoice as any).tenant || {};
  const lease = (invoice as any).lease || {};
  const lines = (invoice as any).lines || [];
  const propertyId = lease.property_id;

  // 4. Fetch property and entity from database
  const [{ data: property }, { data: entity }] = await Promise.all([
    supabase.from('properties').select('property_name').eq('id', propertyId).single(),
    supabase.from('entities').select('entity_name, address, bank_details').eq('id', entityId).single(),
  ]);

  // 5. Build invoice PDF data — 100% from database
  const invoiceData = {
    invoice_number: (invoice as any).invoice_number || `INV-${invoice_id.substring(0, 8).toUpperCase()}`,
    invoice_date: (invoice as any).invoice_date || new Date().toISOString().split('T')[0],
    due_date: (invoice as any).due_date,
    tenant_name: tenant.tenant_name || 'Tenant',
    property_name: property?.property_name || 'Property',
    entity_name: entity?.entity_name || 'AssetFlow',
    entity_address: entity?.address || '',
    bank_details: entity?.bank_details || 'On file',
    line_items: lines.map((l: any) => ({
      description: l.description || 'Charge',
      amount: l.amount || 0,
      vat_rate: l.vat_rate,
    })),
    sub_total: (invoice as any).sub_total || (invoice as any).amount || 0,
    vat_amount: (invoice as any).vat_amount || 0,
    total: (invoice as any).total || ((invoice as any).amount || 0) + ((invoice as any).vat_amount || 0),
  };

  // 6. Generate PDF
  const pdfBytes = await generateInvoicePDF(invoiceData);

  // 7. Upload with signed URL (24hr expiry)
  const signedUrl = await uploadAndGetSignedUrl('documents', `invoices/${invoiceData.invoice_number}.pdf`, pdfBytes);

  const results: any = { email: null, whatsapp: null, errors: [] };
  const preview = `Invoice ${invoiceData.invoice_number} — R${invoiceData.total.toLocaleString()}`;

  // 8. Send Email
  if (send_email && tenant.email) {
    try {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');
      await sgMail.send({
        to: tenant.email,
        from: { email: "hello@assetflow.africa", name: "AssetFlow" },
        subject: `Tax Invoice ${invoiceData.invoice_number}`,
        html: `<h2>AssetFlow</h2><p>Dear ${tenant.tenant_name},</p><p>Your invoice is attached.</p><p style="font-size:18px">Total: <strong>R${invoiceData.total.toLocaleString()}</strong></p><p>Due: ${invoiceData.due_date}</p>`,
        attachments: [{ filename: `Invoice-${invoiceData.invoice_number}.pdf`, content: Buffer.from(pdfBytes).toString('base64'), type: 'application/pdf' }],
      });
      results.email = { success: true };
      await logCommunication({ entity_id: entityId, tenant_id: tenantId, lease_id: lease.id, channel: 'email', direction: 'outbound', template: 'invoice_ready', subject: `Invoice ${invoiceData.invoice_number}`, message_preview: preview, document_url: signedUrl, status: 'sent', sent_by: user.email || user.id });
    } catch (err: any) {
      results.email = { success: false, error: err.message };
      results.errors.push({ channel: 'email', error: err.message });
    }
  }

  // 9. Send WhatsApp via template
  if (send_whatsapp && tenant.whatsapp_number) {
    try {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
      const msg = await client.messages.create({
        from: process.env.TWILIO_WHATSAPP_FROM,
        to: `whatsapp:${tenant.whatsapp_number.replace(/\D/g, "")}`,
        contentSid: process.env.TWILIO_CONTENT_SID_INVOICE,
        contentVariables: JSON.stringify({
          '1': tenant.tenant_name,
          '2': invoiceData.invoice_number,
          '3': `R${invoiceData.total.toLocaleString()}`,
          '4': invoiceData.due_date,
          '5': signedUrl,
        }),
      });
      results.whatsapp = { success: true, messageId: msg.sid };
      await logCommunication({ entity_id: entityId, tenant_id: tenantId, lease_id: lease.id, channel: 'whatsapp', direction: 'outbound', template: 'invoice_ready', message_preview: preview, document_url: signedUrl, status: 'sent', provider_message_id: msg.sid, sent_by: user.email || user.id });
    } catch (err: any) {
      results.whatsapp = { success: false, error: err.message };
      results.errors.push({ channel: 'whatsapp', error: err.message });
    }
  }

  return NextResponse.json({ success: results.errors.length === 0, results });
}
