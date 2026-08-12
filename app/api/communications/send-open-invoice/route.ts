import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import sgMail from "@sendgrid/mail";
import twilio from "twilio";
import { buildRevenueContext } from '@/lib/revenue/revenue-context-builder';
import { generateInvoicePDF } from "@/lib/revenue/invoice-pdf-generator";
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

  const { tenant_id, lease_id, entity_id, period_id } = await request.json();

  if (!tenant_id || !entity_id || !period_id) {
    return NextResponse.json({ error: "tenant_id, entity_id, and period_id are required" }, { status: 400 });
  }

  try {
    // RBAC — verify user has access to this entity
    const { data: access } = await supabase
      .from('user_entity_access')
      .select('entity_id')
      .eq('user_id', user.id)
      .eq('entity_id', entity_id)
      .single();

    if (!access) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    // SERVER resolves current billing state — browser sends only IDs
    const { data: tenant } = await supabase.from('tenants').select('tenant_name, email, whatsapp_number').eq('id', tenant_id).single();
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

    const { data: lease } = await supabase
      .from('leases')
      .select('id, lease_ref, monthly_rental, property_id')
      .eq('id', lease_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (!lease) return NextResponse.json({ error: "Lease not found" }, { status: 404 });

    const { data: property } = await supabase.from('properties').select('property_name, billing_address').eq('id', lease.property_id).single();
    if (!property?.property_name) return NextResponse.json({ error: "Property not found" }, { status: 404 });

    const { data: entity } = await supabase.from('entities').select('entity_name, address, bank_details').eq('id', entity_id).single();
    if (!entity?.entity_name) return NextResponse.json({ error: "Entity not found" }, { status: 404 });

    const { data: period } = await supabase.from('financial_periods').select('period_name, period_start, period_end').eq('id', period_id).single();
    if (!period) return NextResponse.json({ error: "Period not found" }, { status: 404 });

       // Get current billing state from the LIVE worksheet — same source as the Revenue page
    const worksheet = await buildRevenueContext(entity_id, null, period_id, period_id);
    const tenantWorksheet = worksheet.tenants?.find((t: any) => t.tenantId === tenant_id);

    if (!tenantWorksheet) {
      return NextResponse.json({ error: "Tenant not found in current billing worksheet" }, { status: 422 });
    }

    if (!tenantWorksheet.charges || tenantWorksheet.charges.length === 0) {
      return NextResponse.json({ error: "No billable charges found for this tenant and period" }, { status: 422 });
    }

    const lineItems = tenantWorksheet.charges.map((c: any) => ({
      description: c.description,
      amount: c.total || c.amount || 0,
    }));

    const subTotal = tenantWorksheet.charges.reduce((s: number, c: any) => s + (c.amount || 0), 0);
    const vatTotal = tenantWorksheet.charges.reduce((s: number, c: any) => s + (c.vatAmount || 0), 0);
    const total = subTotal + vatTotal;

    // Due date — must come from period, no fallback
    if (!period.period_end) {
      return NextResponse.json({ error: "Invoice due date is not configured — period has no end date" }, { status: 422 });
    }
    const dueDate = period.period_end;

    const invoiceNumber = `INV-${period.period_name.replace(/\s/g, '-')}-${tenant_id.substring(0, 6).toUpperCase()}`;
    // Generate PDF
    const pdfBytes = await generateInvoicePDF({
      invoice_number: invoiceNumber,
      tenant_name: tenant.tenant_name,
      property_name: property.property_name,
      period: period.period_name,
      due_date: dueDate,
      line_items: lineItems,
      sub_total: subTotal,
      vat_amount: vatTotal,
      total,
      entity_name: entity.entity_name,
      entity_address: entity.address || '',
      bank_details: entity.bank_details || '',
      reference: lease.lease_ref || invoiceNumber,
    });

    const signedUrl = await uploadAndGetSignedUrl('documents', `invoices/${invoiceNumber}.pdf`, pdfBytes, 'application/pdf', 86400);

    const results: any = { email: null, whatsapp: null };
    const messagePreview = `Invoice ${invoiceNumber} - R${total.toLocaleString()}`;

    // Send Email
    if (tenant.email) {
      try {
        sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');
        await sgMail.send({
          to: tenant.email,
          from: { email: "hello@assetflow.africa", name: "AssetFlow" },
          subject: `Invoice ${invoiceNumber} - ${property.property_name}`,
          html: `<h2>AssetFlow</h2><p>Dear ${tenant.tenant_name},</p><p>Your invoice for <strong>${period.period_name}</strong> is attached.</p><p style="font-size:18px">Total: <strong>R${total.toLocaleString()}</strong></p>`,
          attachments: [{ filename: `Invoice-${invoiceNumber}.pdf`, content: Buffer.from(pdfBytes).toString('base64'), type: 'application/pdf', disposition: 'attachment' }],
        });
        results.email = { success: true };
        await logCommunication({ entity_id, tenant_id, channel: 'email', direction: 'outbound', template: 'invoice_ready', subject: `Invoice ${invoiceNumber}`, message_preview: messagePreview, document_url: signedUrl, status: 'sent', sent_by: user.email || user.id });
      } catch (err: any) { results.email = { success: false, error: err.message }; }
    }

    // Send WhatsApp via Content Template
    if (tenant.whatsapp_number && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_CONTENT_SID_INVOICE) {
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
    const successful = [results.email?.success, results.whatsapp?.success].filter(Boolean).length;
    const overallStatus = successful === attempted ? 'sent' : successful > 0 ? 'partial' : 'failed';

    return NextResponse.json({ success: overallStatus !== 'failed', status: overallStatus, results });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
