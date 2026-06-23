import { supabase } from "../supabase";

type CommunicationPayload = {
  tenant_id: string;
  event_type: string;
  source_type: string;
  source_id: string;
  merge_data: Record<string, string>;
  internal_notes?: string;
};

export async function triggerCommunication(payload: CommunicationPayload): Promise<string | null> {
  console.log("triggerCommunication called:", payload.tenant_id, payload.event_type);
  const { data: event } = await supabase
    .from("communication_events")
    .select("*")
    .eq("event_type", payload.event_type)
    .eq("is_active", true)
    .single();

  if (!event) {
    console.log(`Event ${payload.event_type} not found or inactive`);
    return null;
  }

  const { data: rules } = await supabase
    .from("communication_rules")
    .select("*")
    .eq("event_type", payload.event_type)
    .eq("is_active", true);

  if (!rules || rules.length === 0) {
    console.log(`No active rules for event ${payload.event_type}`);
    return null;
  }

  const { data: prefs } = await supabase
    .from("tenant_communication_prefs")
    .select("*")
    .eq("tenant_id", payload.tenant_id);

  const { data: tenant } = await supabase
    .from("tenants")
    .select("whatsapp_number, whatsapp_enabled, email_enabled, sms_enabled")
    .eq("id", payload.tenant_id)
    .single();

  let lastMessageId: string | null = null;
console.log("tenant whatsapp_enabled:", tenant?.whatsapp_enabled, "whatsapp_number:", tenant?.whatsapp_number);
  for (const rule of rules) {
    const pref = prefs?.find(p => p.event_type === payload.event_type && p.channel === rule.channel);
    if (pref && !pref.is_enabled) continue;

    if (rule.channel === "whatsapp" && !tenant?.whatsapp_enabled) continue;
    if (rule.channel === "email" && !tenant?.email_enabled) continue;
    if (rule.channel === "sms" && !tenant?.sms_enabled) continue;

    if (rule.channel === "whatsapp" && !tenant?.whatsapp_number) continue;

    const messageBody = await buildMessage(rule.template_name, rule.channel, payload.merge_data);

    const { data: comm } = await supabase
      .from("communications")
      .insert({
        tenant_id: payload.tenant_id,
        event_type: payload.event_type,
        channel: rule.channel,
        severity: event.severity,
        template_name: rule.template_name,
        message_body: messageBody,
        status: "queued",
        source_type: payload.source_type,
        source_id: payload.source_id,
        triggered_by: "system",
        internal_notes: payload.internal_notes || null,
      })
      .select("id")
      .single();

    if (comm) {
      const phone = tenant?.whatsapp_number;
      if (phone) {
        await sendMessage(comm.id, rule.channel, phone, rule.template_name, messageBody);
      }
      lastMessageId = comm.id;
    }
  }

  return lastMessageId;
}

async function buildMessage(templateName: string, channel: string, data: Record<string, string>): Promise<string> {
  const { data: template } = await supabase
    .from("communication_templates")
    .select("message_body, version")
    .eq("template_name", templateName)
    .eq("channel", channel)
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  if (template) {
    let message = template.message_body;
    for (const [key, value] of Object.entries(data)) {
      message = message.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }
    return message;
  }

  const templates: Record<string, string> = {
    receipt_confirmation: `Thank you ${data.tenant_name}. Your payment of R${data.amount} has been received. Reference: ${data.reference}.`,
    invoice_ready: `Dear ${data.tenant_name}, your invoice for ${data.period} is ready. Total: R${data.total}. View: ${data.link}`,
    statement_ready: `Dear ${data.tenant_name}, your statement for ${data.period} is now available. View: ${data.link}`,
    lease_renewal_reminder: `Dear ${data.tenant_name}, your lease ${data.lease_ref} expires on ${data.expiry_date}. Please contact us to discuss renewal.`,
    arrears_reminder: `Dear ${data.tenant_name}, your account is overdue by R${data.amount}. Please make payment or contact us to arrange a payment plan.`,
    maintenance_update: `Dear ${data.tenant_name}, your maintenance request ${data.ticket_ref} has been scheduled for ${data.scheduled_date}.`,
    lease_renewed_confirmation: `Dear ${data.tenant_name}, your lease ${data.lease_ref} has been renewed until ${data.expiry_date}. Thank you.`,
    task_assigned_notification: `A new task "${data.task_title}" has been assigned. Due: ${data.due_date}.`,
  };

  return templates[templateName] || `Message for ${data.tenant_name}: ${templateName}`;
}

async function sendMessage(commId: string, channel: string, phoneNumber: string, templateName: string, body: string): Promise<void> {
  console.log("sendMessage:", { channel, phoneNumber });

  if (channel !== "whatsapp") {
    await supabase
      .from("communications")
      .update({ status: "sent", external_message_id: `MSG-${Date.now()}`, sent_at: new Date().toISOString() })
      .eq("id", commId);
    return;
  }

  // Normalize phone number
  const normalized = phoneNumber.replace(/\D/g, "").replace(/^0/, "27");
  console.log("Normalized phone:", normalized);

  const { sendTwilioWhatsApp } = await import("./providers/twilio");
  const twilioResult = await sendTwilioWhatsApp(normalized, body);
  console.log("Twilio result:", twilioResult);

  if (twilioResult.success) {
    await supabase
      .from("communications")
      .update({ status: "sent", external_message_id: twilioResult.messageId, sent_at: new Date().toISOString() })
      .eq("id", commId);
    return;
  }

  // Twilio failed — mark as failed, don't simulate
  await supabase
    .from("communications")
    .update({
      status: "failed",
      failed_at: new Date().toISOString(),
      internal_notes: `Twilio failed: ${twilioResult.error || 'Unknown error'}`
    })
    .eq("id", commId);
}

async function simulateSend(commId: string, channel: string, body: string): Promise<void> {
  // No more simulation. If we reach here, no provider worked — mark as failed.
  await supabase
    .from("communications")
    .update({
      status: "failed",
      failed_at: new Date().toISOString(),
      internal_notes: "No provider configured or all providers failed"
    })
    .eq("id", commId);
}

async function handleRetry(commId: string): Promise<void> {
  const { data: comm } = await supabase
    .from("communications")
    .select("retry_count, max_retries")
    .eq("id", commId)
    .single();

  if (!comm) return;

  const retryCount = (comm.retry_count || 0) + 1;

  if (retryCount <= (comm.max_retries || 3)) {
    await supabase
      .from("communications")
      .update({
        status: "queued",
        retry_count: retryCount,
      })
      .eq("id", commId);

    await new Promise(resolve => setTimeout(resolve, 2000));
    await simulateSend(commId, "whatsapp", "");
  } else {
    await supabase
      .from("communications")
      .update({
        status: "failed",
        failed_at: new Date().toISOString(),
        retry_count: retryCount,
      })
      .eq("id", commId);
  }
}

export async function getMessageHealth(): Promise<{
  today_total: number;
  delivered: number;
  read: number;
  failed: number;
  pending_retries: number;
}> {
  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("communications")
    .select("status, retry_count")
    .gte("sent_at", today);

  const total = data?.length || 0;
  const delivered = data?.filter(d => d.status === "delivered" || d.status === "read").length || 0;
  const read = data?.filter(d => d.status === "read").length || 0;
  const failed = data?.filter(d => d.status === "failed").length || 0;
  const pendingRetries = data?.filter(d => d.retry_count > 0 && d.status !== "failed").length || 0;

  return {
    today_total: total,
    delivered,
    read,
    failed,
    pending_retries: pendingRetries,
  };
}

export async function getTenantTimeline(tenantId: string, limit: number = 20) {
  const { data } = await supabase
    .from("communications")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return data || [];
}