import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getTenantSummary } from "@/lib/intelligence/tenant-summary";
import { getTenantBalance } from "@/lib/intelligence/tenant-balance";
import { getTenantPayments } from "@/lib/intelligence/tenant-payments";
import { getTenantStatements } from "@/lib/intelligence/tenant-statements";

// Intent detection based on keywords
function detectIntent(message: string): { intent: string; confidence: number } {
  const msg = message.toLowerCase().trim();

  if (/statement|send statement|get statement|latest statement/i.test(msg)) {
    return { intent: "statement_request", confidence: 95 };
  }
  if (/balance|what do i owe|how much do i owe|outstanding|what.*balance/i.test(msg)) {
    return { intent: "balance_enquiry", confidence: 95 };
  }
  if (/lease|expir|when.*lease|lease.*end|lease.*date/i.test(msg)) {
    return { intent: "lease_enquiry", confidence: 90 };
  }
  if (/paid|payment|did you receive|receipt/i.test(msg)) {
    return { intent: "payment_enquiry", confidence: 85 };
  }
  if (/help|talk.*human|speak.*agent|contact.*manager|assist/i.test(msg)) {
    return { intent: "escalation", confidence: 100 };
  }

  return { intent: "unknown", confidence: 0 };
}

// Find tenant by WhatsApp number
async function findTenantByPhone(supabase: any, phone: string) {
  const normalized = phone.replace(/\D/g, "").replace(/^0/, "27").replace(/^27/, "");
  const { data } = await supabase
    .from("tenants")
    .select("id, tenant_name, whatsapp_number")
    .or(`whatsapp_number.ilike.%${normalized}%,whatsapp_number.ilike.%${phone.replace(/\D/g, "")}%`)
    .eq("whatsapp_enabled", true)
    .limit(1)
    .single();
  return data;
}

// Format currency
function formatRands(amount: number): string {
  return `R${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
}

export async function POST(request: NextRequest) {
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

  // Parse Twilio webhook
  const formData = await request.formData();
  const from = formData.get("From") as string;
  const body = formData.get("Body") as string;

  if (!from || !body) {
    return NextResponse.json({ error: "Missing From or Body" }, { status: 400 });
  }

  // Find tenant
  const phoneNumber = from.replace("whatsapp:", "");
  const tenant = await findTenantByPhone(supabase, phoneNumber);

  if (!tenant) {
    return NextResponse.json({ reply: "We couldn't find your account. Please contact your property manager." });
  }

  // Log incoming message
  await supabase.from("communications").insert({
    tenant_id: tenant.id,
    event_type: "whatsapp_incoming",
    channel: "whatsapp",
    message_body: body,
    status: "received",
    source_type: "whatsapp",
    source_id: `WA-${Date.now()}`,
  });

  // Detect intent
  const { intent, confidence } = detectIntent(body);

  let replyText = "";

  try {
    switch (intent) {
      case "statement_request": {
        const statements = await getTenantStatements(supabase, tenant.id, 1);
        const summary = await getTenantSummary(supabase, tenant.id);
        if (statements.length > 0) {
          replyText = `📄 *Your Latest Statement*\n\nPeriod: ${statements[0].period}\nBalance: ${formatRands(summary?.current_balance || 0)}\n\nView your statement at:\nhttps://assetflow.africa/statements`;
        } else {
          replyText = "No statements available yet. Your property manager will send one soon.";
        }
        break;
      }

      case "balance_enquiry": {
        const balance = await getTenantBalance(supabase, tenant.id);
        replyText = `💰 *Your Balance*\n\nCurrent Charges: ${formatRands(balance.current_charges)}\nReceipts: ${formatRands(balance.receipts)}\nBalance Due: ${formatRands(balance.balance_cf)}`;
        break;
      }

      case "lease_enquiry": {
        const summary = await getTenantSummary(supabase, tenant.id);
        if (summary?.expiry_date) {
          replyText = `🏢 *Lease Information*\n\nProperty: ${summary.property_name}\nExpiry Date: ${new Date(summary.expiry_date).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}\nStatus: ${summary.lease_status}`;
        } else {
          replyText = "No active lease found for your account.";
        }
        break;
      }

      case "payment_enquiry": {
        const payments = await getTenantPayments(supabase, tenant.id, 3);
        if (payments.length > 0) {
          const recentPayments = payments.map(p => `${formatRands(p.amount)} on ${p.date}`).join("\n");
          replyText = `💳 *Recent Payments*\n\n${recentPayments}`;
        } else {
          replyText = "No payments recorded yet. Please check with your property manager.";
        }
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
        replyText = "✅ Your request has been escalated to your property manager. They will contact you shortly.";
        break;
      }

      default: {
        replyText = `👋 Hello ${tenant.tenant_name}!\n\nI can help with:\n• Send my statement\n• What's my balance?\n• When does my lease expire?\n• Recent payments\n\nJust ask!`;
        break;
      }
    }
  } catch (error) {
    console.error("WhatsApp webhook error:", error);
    replyText = "Sorry, I couldn't process your request. Your property manager has been notified.";
  }

  // Log response
  await supabase.from("communications").insert({
    tenant_id: tenant.id,
    event_type: "whatsapp_response",
    channel: "whatsapp",
    message_body: replyText,
    status: "sent",
    source_type: "whatsapp",
    source_id: `WA-RESP-${Date.now()}`,
  });

  // Return Twilio-compatible response
  return NextResponse.json({ reply: replyText });
}
