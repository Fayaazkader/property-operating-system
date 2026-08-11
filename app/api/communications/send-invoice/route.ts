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
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll(cookiesToSet: any) { cookiesToSet.forEach(({ name, value, options }: any) => cookieStore.set({ name, value, ...options })); } } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { invoice_id, send_email, send_whatsapp } = await request.json();

  // Fetch invoice from database — the single source of truth
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, tenant:tenant_id(*), lease:lease_id(*), lines:invoice_lines(*)')
    .eq('id', invoice_id)
    .single();

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const inv = invoice as any;

  // Validate required fields before sending
  if (!inv.invoice_number) {
    return NextResponse.json({ error: "Invoice has no invoice number — cannot send" }, { status: 422 });
  }
  if (!inv.due_date) {
    return NextResponse.json({ error: "Invoice has no due date — cannot send" }, { status: 422 });
  }

  // RBAC
  const { data: access } = await supabase
    .from('user_entity_access')
    .select('entity_id')
    .eq('user_id', user.id)
    .eq('entity_id', inv.entity_id)
    .single();
  if (!access) return NextResponse.json({ error: "Access denied" }, { status: 403 });

  const entityId = inv.entity_id;
  const tenantId = inv.tenant_id;
  const tenant = inv.tenant || {};
  const lease = inv.lease || {};
  const lines = inv.lines || [];

  // Fetch property and entity
  const [{ data: property }, { data: entity }] = await Promise.all([
    supabase.from('properties').select('property_name').eq('id', lease.property_id).single(),
    supabase.from('entities').select('entity_name, address, bank_details').eq('id', entityId).single(),
  ]);

  // Validate we have all required data
  if (!tenant.tenant_name || !property?.property_name || !entity?.entity_name) {
    return NextResponse.json({ error: "Missing required tenant/property/entity data — cannot send" }, { status: 422 });
  }

  // Build invoice PDF data — 100% from database
  const invoiceData = {
    invoice_number: inv.invoice_number,
    invoice_date: inv.invoice_date || new Date().toISOString().split('T')[0],
    due_date: inv.due_date,
    tenant_name: tenant.tenant_name,
    property_name: property.property_name,
    entity_name: entity.entity_name,
    entity_address: entity.address || '',
    bank_details: entity.bank_details || 'On file',
    line_items: lines.map((l: any) => ({
      description: l.description || 'Charge',
      amount: l.amount || 0,
      vat_rate: l.vat_rate,
    })),
    sub_total: inv.sub_total || inv.amount || 0,
    vat_amount: inv.vat_amount || 0,
    total: inv.total || (inv.amount || 0) + (inv.vat_amount || 0),
  };

  // Generate PDF
  const pdfBytes = await generateInvoicePDF(invoiceData);

  // Upload with signed URL (24hr expiry)
  const signedUrl = await uploadAndGetSignedUrl('documents', `invoices/${invoiceData.invoice_number}.pdf`, pdfBytes);

  const results: any = { email: null, whatsapp: null, errors: [] };
  const preview = `Invoice ${invoiceData.invoice_number} — R${invoiceData.total.toLocaleString()}`;

  // Send Email
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

  // Send WhatsApp via template
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
