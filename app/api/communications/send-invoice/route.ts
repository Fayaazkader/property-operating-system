import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import sgMail from "@sendgrid/mail";
import twilio from "twilio";
import { generateInvoicePDF } from "@/lib/revenue/invoice-pdf-generator";
import { uploadAndGetSignedUrl } from "@/lib/communications/signed-urls";
import { logCommunication } from "@/lib/communications/communication-log";
import { buildTemplateMessage } from "@/lib/communications/whatsapp-templates";

export async function POST(request: NextRequest) {
  // 1. Authenticate
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: () => cookieStore }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { invoice_id, send_email, send_whatsapp } = await request.json();

  // 2. Fetch and validate invoice
  const { data: invoice } = await supabase
    .from('sub_ledger_entries')
    .select('*, tenants!inner(tenant_name, email, whatsapp_number), leases!inner(id, property_id)')
    .eq('id', invoice_id)
    .single();

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // 3. RBAC — does user have access to this entity?
  const { data: access } = await supabase
    .from('user_entity_access')
    .select('entity_id')
    .eq('user_id', user.id)
    .eq('entity_id', (invoice as any).entity_id)
    .single();

  if (!access) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const entityId = (invoice as any).entity_id;
  const tenantName = (invoice as any).tenants?.tenant_name || 'Tenant';
  const tenantEmail = (invoice as any).tenants?.email;
  const tenantWhatsapp = (invoice as any).tenants?.whatsapp_number;
  const leaseId = (invoice as any).leases?.id;

  // 4. Build validated invoice data
  const invoiceData = {
    invoice_number: `INV-${invoice_id.substring(0, 8).toUpperCase()}`,
    tenant_name: tenantName,
    property_name: 'Property',
    period: new Date().toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' }),
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-ZA'),
    line_items: [{
      description: (invoice as any).description || 'Monthly Rental',
      amount: (invoice as any).debit_amount || 0,
    }],
    sub_total: (invoice as any).debit_amount || 0,
    vat_amount: (invoice as any).vat_amount || 0,
    total: ((invoice as any).debit_amount || 0) + ((invoice as any).vat_amount || 0),
    entity_name: 'AssetFlow Properties',
    entity_address: 'Johannesburg, South Africa',
    bank_details: 'Bank details on file',
    reference: invoice_id.substring(0, 8),
  };

  // 5. Generate PDF
  const pdfBytes = await generateInvoicePDF(invoiceData);

  // 6. Upload to private storage with signed URL
  const signedUrl = await uploadAndGetSignedUrl(
    'documents',
    `invoices/${invoiceData.invoice_number}.pdf`,
    pdfBytes,
    'application/pdf',
    86400 // 24 hours
  );

  const results: any = { email: null, whatsapp: null };
  const messagePreview = `Invoice ${invoiceData.invoice_number} - R${invoiceData.total.toLocaleString()}`;

  try {
    // 7. Send Email
    if (send_email && tenantEmail) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');
      
      await sgMail.send({
        to: tenantEmail,
        from: { email: "hello@assetflow.africa", name: "AssetFlow" },
        subject: `Tax Invoice ${invoiceData.invoice_number}`,
        html: `<h2>AssetFlow</h2><p>Dear ${tenantName},</p><p>Your tax invoice is attached.</p><p style="font-size:18px">Total: <strong>R${invoiceData.total.toLocaleString()}</strong></p><p>Due: ${invoiceData.due_date}</p>`,
        attachments: [{
          filename: `Invoice-${invoiceData.invoice_number}.pdf`,
          content: Buffer.from(pdfBytes).toString('base64'),
          type: 'application/pdf',
          disposition: 'attachment',
        }],
      });

      results.email = { success: true };

      await logCommunication({
        entity_id: entityId,
        tenant_id: (invoice as any).tenant_id,
        lease_id: leaseId,
        channel: 'email',
        direction: 'outbound',
        template: 'invoice_ready',
        subject: `Invoice ${invoiceData.invoice_number}`,
        message_preview: messagePreview,
        document_url: signedUrl,
        status: 'sent',
        sent_by: user.email || user.id,
      });
    }

    // 8. Send WhatsApp with template
    if (send_whatsapp && tenantWhatsapp) {
      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID!,
        process.env.TWILIO_AUTH_TOKEN!
      );

      const template = buildTemplateMessage({
        template: 'invoice_ready',
        to: tenantWhatsapp,
        variables: {
          '1': tenantName,
          '2': invoiceData.invoice_number,
          '3': `R${invoiceData.total.toLocaleString()}`,
          '4': invoiceData.due_date,
        },
        mediaUrl: signedUrl,
      });

      const msg = await client.messages.create({
        from: process.env.TWILIO_WHATSAPP_FROM,
        to: `whatsapp:${tenantWhatsapp.replace(/\D/g, "")}`,
        contentSid: template.contentSid,
        contentVariables: template.contentVariables,
        mediaUrl: template.mediaUrl ? [template.mediaUrl] : undefined,
      });

      results.whatsapp = { success: true, messageId: msg.sid };

      await logCommunication({
        entity_id: entityId,
        tenant_id: (invoice as any).tenant_id,
        lease_id: leaseId,
        channel: 'whatsapp',
        direction: 'outbound',
        template: 'invoice_ready',
        message_preview: messagePreview,
        document_url: signedUrl,
        status: 'sent',
        provider_message_id: msg.sid,
        sent_by: user.email || user.id,
      });
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
