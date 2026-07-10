import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getTenantSummary } from "@/lib/intelligence/tenant-summary";
import { getTenantBalance } from "@/lib/intelligence/tenant-balance";
import { getTenantPayments } from "@/lib/intelligence/tenant-payments";
import { getTenantStatements } from "@/lib/intelligence/tenant-statements";
import { normalizePhone } from "@/lib/intelligence/phone-utils";
import { checkRateLimit } from "@/lib/intelligence/rate-limiter";

function detectIntent(message: string): { intent: string; confidence: number } {
  const msg = message.toLowerCase().trim();
  if (/statement|send statement|get statement/i.test(msg)) return { intent: "statement_request", confidence: 95 };
  if (/balance|what do i owe|how much do i owe|outstanding/i.test(msg)) return { intent: "balance_enquiry", confidence: 95 };
  if (/lease|expir|when.*lease/i.test(msg)) return { intent: "lease_enquiry", confidence: 90 };
  if (/payment.*received|did you receive|has.*payment.*allocated|payment.*gone through|paid.*yet/i.test(msg)) return { intent: "payment_allocation", confidence: 88 };
  if (/paid|payment|receipt/i.test(msg)) return { intent: "payment_enquiry", confidence: 85 };
  if (/next payment|when.*pay|due date|payment due/i.test(msg)) return { intent: "next_payment_due", confidence: 85 };
  if (/maintenance|leak|broken|repair|fix|not working|stopped|issue|problem|emergency/i.test(msg)) return { intent: "maintenance_request", confidence: 92 };
  if (/send.*lease|lease.*document|lease.*pdf|copy.*lease/i.test(msg)) return { intent: "lease_document", confidence: 90 };
  if (/why.*higher|why.*more|explain.*charge|bill.*higher|charge.*explain/i.test(msg)) return { intent: "bill_explanation", confidence: 82 };
  if (/help|talk.*human|speak.*agent|contact.*manager/i.test(msg)) return { intent: "escalation", confidence: 100 };
  return { intent: "unknown", confidence: 0 };
}

async function findTenantByPhone(supabase: any, phone: string) {
  const normalized = normalizePhone(phone);
  const { data } = await supabase
    .from("tenants")
    .select("id, tenant_name, whatsapp_number")
    .not("whatsapp_number", "is", null)
    .eq("whatsapp_enabled", true);
  return (data || []).find((t: any) => {
    if (!t.whatsapp_number) return false;
    return normalizePhone(t.whatsapp_number) === normalized;
  }) || null;
}

function formatRands(amount: number): string {
  return `R${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set({ name, value, ...options }));
          },
        },
      }
    );

    const formData = await request.formData();
    const from = formData.get("From") as string;
    const body = formData.get("Body") as string;
    const messageSid = formData.get("MessageSid") as string;
    const numMedia = parseInt(formData.get("NumMedia") as string || "0");

    if (!from || !body) {
      return new NextResponse("Missing From or Body", { status: 400 });
    }

    if (messageSid) {
      const { data: existing } = await supabase.from("communications").select("id").eq("message_sid", messageSid).limit(1);
      if (existing && existing.length > 0) return new NextResponse("OK", { status: 200 });
    }

    const phoneNumber = from.replace("whatsapp:", "");
    const phoneKey = normalizePhone(phoneNumber);
    if (!checkRateLimit(phoneKey)) {
      return new NextResponse("You've reached the message limit. Please try again later.", { status: 200 });
    }

    const tenant = await findTenantByPhone(supabase, phoneNumber);
    if (!tenant) {
      return new NextResponse("We couldn't find your account. Please contact your property manager.", { status: 200 });
    }

    // Check for media attachments (maintenance photos)
    let mediaUrls: string[] = [];
    if (numMedia > 0) {
      for (let i = 0; i < numMedia; i++) {
        const mediaUrl = formData.get(`MediaUrl${i}`);
        if (mediaUrl) mediaUrls.push(mediaUrl as string);
      }
    }

    await supabase.from("communications").insert({
      tenant_id: tenant.id, event_type: "whatsapp_incoming", channel: "whatsapp",
      message_body: body, message_sid: messageSid || null, status: "received",
      source_type: "whatsapp", source_id: `WA-${Date.now()}`,
    });

    const { intent } = detectIntent(body);
    let replyText = "";

    switch (intent) {
      case "statement_request": {
        const statements = await getTenantStatements(supabase, tenant.id, 1);
        const summary = await getTenantSummary(supabase, tenant.id);
        replyText = statements.length > 0
          ? `📄 Your latest statement\n\nPeriod: ${statements[0].period}\nBalance: ${formatRands(summary?.current_balance || 0)}\n\nView your statement at:\nhttps://assetflow.africa`
          : "No statements available yet. Your property manager will send one soon.";
        break;
      }
      case "balance_enquiry": {
        const balance = await getTenantBalance(supabase, tenant.id);
        replyText = `💰 Your Balance\n\nCurrent Charges: ${formatRands(balance.current_charges)}\nReceipts: ${formatRands(balance.receipts)}\nBalance Due: ${formatRands(balance.balance_cf)}`;
        break;
      }
      case "lease_enquiry": {
        const summary = await getTenantSummary(supabase, tenant.id);
        replyText = summary?.expiry_date
          ? `🏢 Lease Information\n\nProperty: ${summary.property_name}\nExpiry: ${new Date(summary.expiry_date).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}\nStatus: ${summary.lease_status}\nRemaining: ${Math.ceil((new Date(summary.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days`
          : "No active lease found.";
        break;
      }
      case "payment_allocation": {
        const payments = await getTenantPayments(supabase, tenant.id, 5);
        if (payments.length > 0) {
          const recent = payments[0];
          replyText = `💳 Payment Status\n\nYour most recent payment:\n${formatRands(recent.amount)} on ${recent.date}\nReference: ${recent.reference}\n\nStatus: Allocated ✅`;
        } else {
          replyText = "No payments recorded yet. Please check with your property manager. If you've just paid, it may take 1-2 business days to reflect.";
        }
        break;
      }
      case "next_payment_due": {
        const summary = await getTenantSummary(supabase, tenant.id);
        const balance = await getTenantBalance(supabase, tenant.id);
        replyText = `📅 Payment Information\n\nCurrent Balance: ${formatRands(balance.balance_cf)}\nMonthly Rental: ${summary?.lease_id ? formatRands(summary?.current_balance || 0) : "—"}\n\nPayments are due by the 1st of each month.\n\nBank: FNB\nAccount: 1234567890\nRef: ${tenant.tenant_name}`;
        break;
      }
      case "maintenance_request": {
        const summary = await getTenantSummary(supabase, tenant.id);
        await supabase.from("tasks").insert({
          tenant_id: tenant.id,
          title: `Maintenance: ${body.slice(0, 100)}`,
          description: `WhatsApp request from ${tenant.tenant_name}${summary?.property_name ? ` at ${summary.property_name}` : ""}.${mediaUrls.length > 0 ? `\n\nPhotos: ${mediaUrls.join(", ")}` : ""}`,
          status: "open",
          priority: body.toLowerCase().includes("emergency") || body.toLowerCase().includes("urgent") ? "high" : "medium",
          source: "whatsapp",
          due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        });
        replyText = `🔧 Maintenance Request Logged\n\n${mediaUrls.length > 0 ? `📷 ${mediaUrls.length} photo(s) attached\n\n` : ""}Your request has been logged and your property manager has been notified.\n\nProperty: ${summary?.property_name || "Your property"}\nExpected response: Within 24 hours\n\nReference: TKT-${Date.now().toString(36).toUpperCase()}`;
        break;
      }
      case "lease_document": {
        const summary = await getTenantSummary(supabase, tenant.id);
        replyText = summary?.lease_id
          ? `📄 Lease Document\n\nYour lease (${summary.lease_id}) for ${summary.property_name} is available in your tenant portal.\n\nVisit: https://assetflow.africa\n\nOr reply "help" to speak to your property manager who can email it to you.`
          : "No active lease document found. Please contact your property manager.";
        break;
      }
      case "bill_explanation": {
        const balance = await getTenantBalance(supabase, tenant.id);
        const statements = await getTenantStatements(supabase, tenant.id, 2);
        replyText = `📊 Bill Breakdown\n\nYour current charges: ${formatRands(balance.current_charges)}\n\nThis includes:\n• Base Rental\n• Parking\n• Utilities Recovery\n• Rates Recovery\n\nFor a detailed breakdown, view your latest statement or contact your property manager.`;
        break;
      }
      case "payment_enquiry": {
        const payments = await getTenantPayments(supabase, tenant.id, 3);
        replyText = payments.length > 0
          ? `💳 Recent Payments\n\n${payments.map(p => `${formatRands(p.amount)} on ${p.date}`).join("\n")}`
          : "No payments recorded yet.";
        break;
      }
      case "escalation": {
        await supabase.from("communications").insert({
          tenant_id: tenant.id, event_type: "escalation_request", channel: "whatsapp",
          message_body: body, status: "escalated", severity: "high",
          source_type: "whatsapp", source_id: `ESC-${Date.now()}`,
        });
        replyText = "✅ Your request has been escalated. Your property manager will contact you shortly.";
        break;
      }
      default: {
        replyText = `👋 Hello ${tenant.tenant_name}!\n\nI can help with:\n• What's my balance?\n• Send my statement\n• When does my lease expire?\n• Have you received my payment?\n• When is my next payment due?\n• Log a maintenance request\n• Send me my lease document\n• Why is my bill higher?\n\nJust ask!`;
      }
    }

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