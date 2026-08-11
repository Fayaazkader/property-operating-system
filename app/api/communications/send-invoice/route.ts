import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import sgMail from "@sendgrid/mail";
import twilio from "twilio";
import { generateInvoicePDF } from "@/lib/revenue/invoice-pdf-generator";
import { uploadAndGetSignedUrl } from "@/lib/communications/signed-urls";
import { logCommunication } from "@/lib/communications/communication-log";
import { getInvoiceForDelivery, InvoiceValidationError } from "@/lib/revenue/invoice-service";

export async function POST(request: NextRequest) {
  // 1. Authenticate
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }: any) => cookieStore.set({ name, value, ...options })); } } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { invoice_id, send_email, send_whatsapp } = await request.json();

  if (!invoice_id) {
    return NextResponse.json({ error: "invoice_id is required" }, { status: 400 });
  }

  // Reject if no channels requested
  if (!send_email && !send_whatsapp) {
    return NextResponse.json({ error: "no_channels_requested" }, { status: 400 });
  }

  try {
    // 2. Fetch and validate invoice
    const invoiceData = await getInvoiceForDelivery(invoice_id);

    // 3. RBAC check
    const { data: access } = await supabase
      .from('user_entity_access')
      .select('entity_id')
      .eq('user_id', user.id)
      .eq('entity_id', invoiceData.entity_id)
      .single();

    if (!access) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // 4. Generate PDF
    const pdfBytes = await generateInvoicePDF({
      invoice_number: invoiceData.invoice_number,
      tenant_name: invoiceData.tenant_name,
      property_name: invoiceData.property_name,
      period: invoiceData.period,
      due_date: invoiceData.due_date,
      line_items: invoiceData.line_items,
      sub_total: invoiceData.sub_total,
      vat_amount: invoiceData.vat_amount,
      total: invoiceData.total,
      entity_name: invoiceData.entity_name,
      entity_address: invoiceData.entity_address,
      bank_details: invoiceData.bank_details,
      reference: invoiceData.reference,
    });

    // 5. Upload to private storage with signed URL (24h expiry)
    const signedUrl = await uploadAndGetSignedUrl(
      'documents',
      `invoices/${invoiceData.invoice_number}.pdf`,
      pdfBytes,
      'application/pdf',
      86400
    );

    const results: any = { email: null, whatsapp: null };
    const messagePreview = `Invoice ${invoiceData.invoice_number} - R${invoiceData.total.toLocaleString()}`;
    let emailSuccess = false;
    let whatsappSuccess = false;

    // 6. Send Email
    if (send_email && invoiceData.tenant_email) {
      try {
        sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');
        await sgMail.send({
          to: invoiceData.tenant_email,
          from: { email: "hello@assetflow.africa", name: "AssetFlow" },
          subject: `Tax Invoice ${invoiceData.invoice_number} - ${invoiceData.property_name}`,
          html: `<h2>AssetFlow</h2><p>Dear ${invoiceData.tenant_name},</p><p>Your tax invoice for <strong>${invoiceData.period}</strong> is attached.</p><p style="font-size:18px">Total Due: <strong>R${invoiceData.total.toLocaleString()}</strong></p><p>Due Date: ${invoiceData.due_date}</p><p>Thank you for your prompt payment.</p>`,
          attachments: [{
            filename: `Invoice-${invoiceData.invoice_number}.pdf`,
            content: Buffer.from(pdfBytes).toString('base64'),
            type: 'application/pdf',
            disposition: 'attachment',
          }],
        });
        emailSuccess = true;
        results.email = { success: true };

        await logCommunication({
          entity_id: invoiceData.entity_id,
          tenant_id: invoiceData.tenant_id,
          lease_id: invoiceData.lease_id,
          channel: 'email',
          direction: 'outbound',
          template: 'invoice_ready',
          subject: `Invoice ${invoiceData.invoice_number}`,
          message_preview: messagePreview,
          document_url: signedUrl,
          status: 'sent',
          sent_by: user.email || user.id,
        });
      } catch (err: any) {
        results.email = { success: false, error: err.message };
      }
    }

    // 7. Send WhatsApp via Content Template
    if (send_whatsapp && invoiceData.tenant_whatsapp && process.env.TWILIO_CONTENT_SID_INVOICE) {
      try {
        const client = twilio(
          process.env.TWILIO_ACCOUNT_SID!,
          process.env.TWILIO_AUTH_TOKEN!
        );

        const msg = await client.messages.create({
          from: process.env.TWILIO_WHATSAPP_FROM,
          to: `whatsapp:${invoiceData.tenant_whatsapp.replace(/\D/g, "")}`,
          contentSid: process.env.TWILIO_CONTENT_SID_INVOICE,
          contentVariables: JSON.stringify({
            '1': invoiceData.tenant_name,
            '2': invoiceData.invoice_number,
            '3': `R${invoiceData.total.toLocaleString()}`,
            '4': invoiceData.due_date,
            '5': signedUrl,
          }),
        });

        whatsappSuccess = true;
        results.whatsapp = { success: true, messageId: msg.sid };

        await logCommunication({
          entity_id: invoiceData.entity_id,
          tenant_id: invoiceData.tenant_id,
          lease_id: invoiceData.lease_id,
          channel: 'whatsapp',
          direction: 'outbound',
          template: 'invoice_ready',
          message_preview: messagePreview,
          document_url: signedUrl,
          status: 'sent',
          provider_message_id: msg.sid,
          sent_by: user.email || user.id,
        });
      } catch (err: any) {
        results.whatsapp = { success: false, error: err.message };
      }
    }

    // 8. Calculate overall status
    const attempted = [send_email && !!invoiceData.tenant_email, send_whatsapp && !!invoiceData.tenant_whatsapp].filter(Boolean).length;
    const successful = [emailSuccess, whatsappSuccess].filter(Boolean).length;
    const overallStatus = successful === attempted ? 'sent' : successful > 0 ? 'partial' : 'failed';

    return NextResponse.json({
      success: overallStatus !== 'failed',
      status: overallStatus,
      results,
    });

  } catch (error: any) {
    if (error instanceof InvoiceValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 422 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
