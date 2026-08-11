import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import sgMail from "@sendgrid/mail";
import twilio from "twilio";
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { uploadAndGetSignedUrl } from "@/lib/communications/signed-urls";
import { logCommunication } from "@/lib/communications/communication-log";

async function generateInvoicePDF(data: any): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = height - 50;
  page.drawText('TAX INVOICE', { x: 50, y, size: 20, font: boldFont, color: rgb(0, 0, 0) });
  y -= 30;
  page.drawText(data.entity_name || 'AssetFlow', { x: 50, y, size: 10, font: boldFont, color: rgb(0, 0, 0) });
  y -= 15;
  page.drawText(data.entity_address || '', { x: 50, y, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
  y -= 25;
  page.drawText(`Invoice: ${data.invoice_number}`, { x: 50, y, size: 10, font: boldFont, color: rgb(0, 0, 0) });
  y -= 18;
  page.drawText(`Date: ${data.invoice_date || new Date().toLocaleDateString('en-ZA')}`, { x: 50, y, size: 9, font, color: rgb(0, 0, 0) });
  y -= 15;
  page.drawText(`Due: ${data.due_date}`, { x: 50, y, size: 9, font, color: rgb(0, 0, 0) });
  y -= 25;
  page.drawText('Bill To:', { x: 50, y, size: 10, font: boldFont, color: rgb(0, 0, 0) });
  y -= 18;
  page.drawText(data.tenant_name || '', { x: 50, y, size: 10, font, color: rgb(0, 0, 0) });
  y -= 15;
  page.drawText(data.property_name || '', { x: 50, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
  y -= 25;
  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  y -= 20;
  
  for (const item of (data.line_items || [])) {
    page.drawText(item.description, { x: 50, y, size: 9, font, color: rgb(0, 0, 0) });
    page.drawText(`R${(item.amount || 0).toLocaleString()}`, { x: width - 120, y, size: 9, font, color: rgb(0, 0, 0) });
    y -= 15;
  }
  
  y -= 5;
  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
  y -= 18;
  page.drawText(`TOTAL DUE: R${(data.total || 0).toLocaleString()}`, { x: width - 250, y, size: 12, font: boldFont, color: rgb(0, 0, 0) });
  y -= 35;
  page.drawText(data.bank_details || '', { x: 50, y, size: 9, font, color: rgb(0, 0, 0) });
  
  return pdfDoc.save();
}

export async function POST(request: NextRequest) {
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

  // Fetch invoice from database — the source of truth
  const { data: invoice } = await supabase
    .from('sub_ledger_entries')
    .select('*, tenants!inner(tenant_name, email, whatsapp_number), leases!inner(id, property_id)')
    .eq('id', invoice_id)
    .single();

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // RBAC
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
  const tenantId = (invoice as any).tenant_id;
  const tenantName = (invoice as any).tenants?.tenant_name || 'Tenant';
  const tenantEmail = (invoice as any).tenants?.email;
  const tenantWhatsapp = (invoice as any).tenants?.whatsapp_number;
  const leaseId = (invoice as any).leases?.id;
  const propertyId = (invoice as any).leases?.property_id;

  // Fetch property and entity data from database
  const [{ data: propertyData }, { data: entityData }] = await Promise.all([
    supabase.from('properties').select('property_name').eq('id', propertyId).single(),
    supabase.from('entities').select('entity_name, address, bank_details').eq('id', entityId).single(),
  ]);

  // Build invoice data 100% from database
  const invoiceData = {
    invoice_number: `INV-${invoice_id.substring(0, 8).toUpperCase()}`,
    invoice_date: new Date().toLocaleDateString('en-ZA'),
    tenant_name: tenantName,
    property_name: propertyData?.property_name || 'Property',
    period: new Date().toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' }),
    due_date: (invoice as any).due_date || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    line_items: [{
      description: (invoice as any).description || 'Monthly Rental',
      amount: (invoice as any).debit_amount || 0,
    }],
    total: ((invoice as any).debit_amount || 0) + ((invoice as any).vat_amount || 0),
    entity_name: entityData?.entity_name || 'AssetFlow',
    entity_address: entityData?.address || '',
    bank_details: entityData?.bank_details || '',
  };

  // Generate PDF
  const pdfBytes = await generateInvoicePDF(invoiceData);

  // Upload with signed URL
  const signedUrl = await uploadAndGetSignedUrl('documents', `invoices/${invoiceData.invoice_number}.pdf`, pdfBytes);

  const results: any = { email: null, whatsapp: null, errors: [] };
  const messagePreview = `Invoice ${invoiceData.invoice_number} - R${invoiceData.total.toLocaleString()}`;

  // Send Email
  if (send_email && tenantEmail) {
    try {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');
      await sgMail.send({
        to: tenantEmail,
        from: { email: "hello@assetflow.africa", name: "AssetFlow" },
        subject: `Tax Invoice ${invoiceData.invoice_number}`,
        html: `<h2>AssetFlow</h2><p>Dear ${tenantName},</p><p>Your tax invoice is attached.</p><p style="font-size:18px">Total: <strong>R${invoiceData.total.toLocaleString()}</strong></p><p>Due: ${invoiceData.due_date}</p>`,
        attachments: [{ filename: `Invoice-${invoiceData.invoice_number}.pdf`, content: Buffer.from(pdfBytes).toString('base64'), type: 'application/pdf', disposition: 'attachment' }],
      });
      results.email = { success: true };
      await logCommunication({ entity_id: entityId, tenant_id: tenantId, lease_id: leaseId, channel: 'email', direction: 'outbound', template: 'invoice_ready', subject: `Invoice ${invoiceData.invoice_number}`, message_preview: messagePreview, document_url: signedUrl, status: 'sent', sent_by: user.email || user.id });
    } catch (err: any) {
      results.email = { success: false, error: err.message };
      results.errors.push({ channel: 'email', error: err.message });
    }
  }

  // Send WhatsApp
  if (send_whatsapp && tenantWhatsapp) {
    try {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
      const msg = await client.messages.create({
        from: process.env.TWILIO_WHATSAPP_FROM,
        to: `whatsapp:${tenantWhatsapp.replace(/\D/g, "")}`,
        contentSid: process.env.TWILIO_CONTENT_SID_INVOICE,
        contentVariables: JSON.stringify({ '1': tenantName, '2': invoiceData.invoice_number, '3': `R${invoiceData.total.toLocaleString()}`, '4': invoiceData.due_date, '5': signedUrl }),
      });
      results.whatsapp = { success: true, messageId: msg.sid };
      await logCommunication({ entity_id: entityId, tenant_id: tenantId, lease_id: leaseId, channel: 'whatsapp', direction: 'outbound', template: 'invoice_ready', message_preview: messagePreview, document_url: signedUrl, status: 'sent', provider_message_id: msg.sid, sent_by: user.email || user.id });
    } catch (err: any) {
      results.whatsapp = { success: false, error: err.message };
      results.errors.push({ channel: 'whatsapp', error: err.message });
    }
  }

  return NextResponse.json({ success: results.errors.length === 0, results });
}
