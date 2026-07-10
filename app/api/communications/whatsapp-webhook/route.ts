import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { normalizePhone } from "@/lib/intelligence/phone-utils";
import { checkRateLimit } from "@/lib/intelligence/rate-limiter";
import { getTenantSummary } from "@/lib/intelligence/tenant-summary";
import { getTenantBalance } from "@/lib/intelligence/tenant-balance";
import {
  getContext, updateContext, checkPermission,
  classifyIntent, ConversationContext,
  handleBalanceEnquiry, handleStatementRequest, handleLeaseEnquiry,
  handlePaymentAllocation, handleMaintenanceRequest, handleRenewalRequest, handleEmergency,
} from "@/lib/conversation/engine";

function formatRands(amount: number): string {
  if (!amount || isNaN(amount)) return "R0.00";
  return `R${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
}

async function findTenantByPhone(supabase: any, phone: string) {
  const normalized = normalizePhone(phone);
  const { data } = await supabase.from("tenants").select("id, tenant_name, whatsapp_number").not("whatsapp_number", "is", null).eq("whatsapp_enabled", true);
  return (data || []).find((t: any) => !t.whatsapp_number ? false : normalizePhone(t.whatsapp_number) === normalized) || null;
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); }, setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set({ name, value, ...options })); } } }
    );

    const formData = await request.formData();
    const from = formData.get("From") as string;
    const body = formData.get("Body") as string;
    const messageSid = formData.get("MessageSid") as string;
    const numMedia = parseInt(formData.get("NumMedia") as string || "0");

    if (!from || !body) return new NextResponse("Missing From or Body", { status: 400 });
    if (messageSid) {
      const { data: existing } = await supabase.from("communications").select("id").eq("message_sid", messageSid).limit(1);
      if (existing && existing.length > 0) return new NextResponse("OK", { status: 200 });
    }

    const phoneNumber = from.replace("whatsapp:", "");
    if (!checkRateLimit(normalizePhone(phoneNumber))) {
      return new NextResponse("Message limit reached. Please try again later.", { status: 200 });
    }

    const tenant = await findTenantByPhone(supabase, phoneNumber);
    if (!tenant) return new NextResponse("We couldn't find your account. Please contact your property manager.", { status: 200 });

    let mediaUrls: string[] = [];
    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = formData.get(`MediaUrl${i}`);
      if (mediaUrl) mediaUrls.push(mediaUrl as string);
    }

    const context = await getContext(tenant.id, tenant.tenant_name);
    await supabase.from("communications").insert({
      tenant_id: tenant.id, event_type: "whatsapp_incoming", channel: "whatsapp",
      message_body: body, message_sid: messageSid || null, status: "received",
      source_type: "whatsapp", source_id: `WA-${Date.now()}`,
    });

    const { intent, confidence, requiresClarification, clarificationQuestion, requiredRole } = await classifyIntent(body, context);

    // Permission check
    if (!checkPermission(context.tenantRole, requiredRole)) {
      const replyText = `Sorry, that information isn't available for your account type. Please contact your property manager for assistance.`;
      await supabase.from("communications").insert({ tenant_id: tenant.id, event_type: "whatsapp_response", channel: "whatsapp", message_body: replyText, status: "sent", source_type: "whatsapp", source_id: `WA-RESP-${Date.now()}` });
      return new NextResponse(replyText, { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    let replyText = "";
    let requiresHuman = false;

    const summary = await getTenantSummary(supabase, tenant.id);
    const balance = await getTenantBalance(supabase, tenant.id);

    switch (intent) {
      case "balance_enquiry": {
        const result = await handleBalanceEnquiry(tenant.id, tenant.tenant_name, supabase);
        replyText = result.reply; requiresHuman = result.requiresHumanReview;
        break;
      }
      case "statement_request": {
        const result = await handleStatementRequest(tenant.id, supabase);
        replyText = result.reply;
        break;
      }
      case "lease_enquiry": {
        const result = await handleLeaseEnquiry(tenant.id, supabase);
        replyText = result.reply;
        break;
      }
      case "payment_allocation": {
        const result = await handlePaymentAllocation(tenant.id, supabase);
        replyText = result.reply;
        break;
      }
      case "maintenance_request": {
        if (requiresClarification && mediaUrls.length === 0) {
          replyText = `🔧 Maintenance Request\n\n${clarificationQuestion}\n\nOr describe the issue and I'll log it now.`;
        } else {
          const result = await handleMaintenanceRequest(tenant.id, tenant.tenant_name, body, mediaUrls, summary);
          replyText = result.reply; requiresHuman = result.requiresHumanReview;
        }
        break;
      }
      case "renewal_request": {
        const result = await handleRenewalRequest(tenant.id, body, summary);
        replyText = result.reply; requiresHuman = true;
        break;
      }
      case "emergency": {
        const result = await handleEmergency(tenant.id, body);
        replyText = result.reply; requiresHuman = true;
        break;
      }
      case "next_payment_due": {
        replyText = `📅 Payment Due\n\nBalance: ${formatRands(balance.balance_cf)}\nCharges: ${formatRands(balance.current_charges)}/mo\n\nDue: 1st of each month\nBank: FNB | Acc: 1234567890\nRef: ${tenant.tenant_name.replace(/\s/g, "")}`;
        break;
      }
      case "bill_explanation": {
        replyText = `📊 Bill Breakdown\n\nTotal: ${formatRands(balance.current_charges)}\nReceipts: ${formatRands(balance.receipts)}\nBalance: ${formatRands(balance.balance_cf)}\n\nIncludes: Rental, Parking, Utilities, Rates\n\nReply "statement" for detailed statement.`;
        break;
      }
      case "lease_document": {
        replyText = summary?.lease_id ? `📄 Lease Document\n\nLease: ${summary.lease_id}\nProperty: ${summary.property_name}\n\nAvailable at: https://assetflow.africa` : "No active lease document found.";
        break;
      }
      case "banking_details": {
        replyText = `🏦 Banking\n\nBank: FNB\nAccount: 1234567890\nBranch: 250655\nRef: ${tenant.tenant_name.replace(/\s/g, "")}`;
        break;
      }
      case "office_hours": {
        replyText = `🕐 Office Hours\n\nMon-Fri: 08:00-17:00\nSat: 09:00-12:00\nSun: Closed\n\nEmergencies: Reply "emergency"`;
        break;
      }
      case "escalation": {
        await supabase.from("communications").insert({ tenant_id: tenant.id, event_type: "escalation_request", channel: "whatsapp", message_body: body, status: "escalated", severity: "high", source_type: "whatsapp", source_id: `ESC-${Date.now()}` });
        replyText = "✅ Escalated. Your property manager will contact you shortly.\n\nUrgent: 📞 087 729 5319";
        requiresHuman = true;
        break;
      }
      default: {
        replyText = `👋 Hello ${tenant.tenant_name}!\n\nI can help with:\n💰 Balance | 📄 Statement | 🏢 Lease\n💳 Payment status | 📅 Due date\n🔧 Maintenance | 📑 Lease doc\n📊 Bill explanation | 🏦 Banking\n🔄 Renewal | 🏦 Deposit\n\nJust ask — 24/7.`;
      }
    }

    await updateContext(context, intent, body);
    await supabase.from("communications").insert({
      tenant_id: tenant.id, event_type: "whatsapp_response", channel: "whatsapp",
      message_body: replyText, status: "sent", source_type: "whatsapp",
      source_id: `WA-RESP-${Date.now()}`,
    });

    return new NextResponse(replyText, { status: 200, headers: { "Content-Type": "text/plain" } });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new NextResponse("Sorry, something went wrong. Please try again.", { status: 200 });
  }
}
