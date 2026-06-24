import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getTenantSummary } from "@/lib/intelligence/tenant-summary";
import { getTenantBalance } from "@/lib/intelligence/tenant-balance";
import { getTenantPayments } from "@/lib/intelligence/tenant-payments";
import { getTenantStatements } from "@/lib/intelligence/tenant-statements";
import { normalizePhone } from "@/lib/intelligence/phone-utils";

function detectIntent(message: string): { intent: string; confidence: number } {
  const msg = message.toLowerCase().trim();
  if (/statement|send statement|get statement/i.test(msg)) return { intent: "statement_request", confidence: 95 };
  if (/balance|what do i owe|how much do i owe|outstanding/i.test(msg)) return { intent: "balance_enquiry", confidence: 95 };
  if (/lease|expir|when.*lease/i.test(msg)) return { intent: "lease_enquiry", confidence: 90 };
  if (/paid|payment|did you receive|receipt/i.test(msg)) return { intent: "payment_enquiry", confidence: 85 };
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

    if (!from || !body) {
      return new NextResponse("Missing From or Body", { status: 400 });
    }

    // Deduplication check
    if (messageSid) {
      const { data: existing } = await supabase
        .from("communications")
        .select("id")
        .eq("message_sid", messageSid)
        .limit(1);
      if (existing && existing.length > 0) {
        return new NextResponse("OK", { status: 200 });
      }
    }

    const phoneNumber = from.replace("whatsapp:", "");
    const tenant = await findTenantByPhone(supabase, phoneNumber);

    if (!tenant) {
      return new NextResponse("We couldn't find your account. Please contact your property manager.", { status: 200 });
    }

    await supabase.from("communications").insert({
      tenant_id: tenant.id,
      event_type: "whatsapp_incoming",
      channel: "whatsapp",
      message_body: body,
      message_sid: messageSid || null,
      status: "received",
      source_type: "whatsapp",
      source_id: `WA-${Date.now()}`,
    });

    const { intent } = detectIntent(body);
    let replyText = "";

    switch (intent) {
      case "statement_request": {
        const statements = await getTenantStatements(supabase, tenant.id, 1);
        const summary = await getTenantSummary(supabase, tenant.id);
        replyText = statements.length > 0
          ? `📄 Your latest statement\n\nPeriod: ${statements[0].period}\nBalance: ${formatRands(summary?.current_balance || 0)}`
          : "No statements available yet.";
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
          ? `🏢 Lease Information\n\nProperty: ${summary.property_name}\nExpiry: ${new Date(summary.expiry_date).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}\nStatus: ${summary.lease_status}`
          : "No active lease found.";
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
          tenant_id: tenant.id,
          event_type: "escalation_request",
          channel: "whatsapp",
          message_body: body,
          status: "escalated",
          severity: "high",
          source_type: "whatsapp",
          source_id: `ESC-${Date.now()}`,
        });
        replyText = "✅ Your request has been escalated. Your property manager will contact you shortly.";
        break;
      }
      default: {
        replyText = `👋 Hello ${tenant.tenant_name}!\n\nI can help with:\n• Send my statement\n• What's my balance?\n• When does my lease expire?\n• Recent payments`;
      }
    }

    await supabase.from("communications").insert({
      tenant_id: tenant.id,
      event_type: "whatsapp_response",
      channel: "whatsapp",
      message_body: replyText,
      status: "sent",
      source_type: "whatsapp",
      source_id: `WA-RESP-${Date.now()}`,
    });

    return new NextResponse(replyText, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new NextResponse("Sorry, something went wrong. Please try again.", { status: 200 });
  }
}
