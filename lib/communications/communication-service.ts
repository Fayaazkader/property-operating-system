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
  // 1. Get the event
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

  // 2. Get active rules for this event
  const { data: rules } = await supabase
    .from("communication_rules")
    .select("*")
    .eq("event_type", payload.event_type)
    .eq("is_active", true);

  if (!rules || rules.length === 0) {
    console.log(`No active rules for event ${payload.event_type}`);
    return null;
  }

  // 3. Get tenant preferences
  const { data: prefs } = await supabase
    .from("tenant_communication_prefs")
    .select("*")
    .eq("tenant_id", payload.tenant_id);

  // 4. Get tenant contact info
  const { data: tenant } = await supabase
    .from("tenants")
    .select("whatsapp_number, whatsapp_enabled, email_enabled, sms_enabled")
    .eq("id", payload.tenant_id)
    .single();

  let lastMessageId: string | null = null;

  for (const rule of rules) {
    // Check tenant preference for this event + channel
    const pref = prefs?.find(p => p.event_type === payload.event_type && p.channel === rule.channel);
    if (pref && !pref.is_enabled) continue;

    // Check tenant has this channel enabled
    if (rule.channel === "whatsapp" && !tenant?.whatsapp_enabled) continue;
    if (rule.channel === "email" && !tenant?.email_enabled) continue;
    if (rule.channel === "sms" && !tenant?.sms_enabled) continue;

    // Check contact info exists
    if (rule.channel === "whatsapp" && !tenant?.whatsapp_number) continue;

    // Build message from template
    const messageBody = await buildMessage(rule.template_name, rule.channel, payload.merge_data);

    // Create communication record
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
      await sendMessage(comm.id, rule.channel, tenant?.whatsapp_number || "", rule.template_name, messageBody);
      lastMessageId = comm.id;
    }
  }

  return lastMessageId;
}

async function buildMessage(templateName: string, channel: string, data: Record<string, string>): Promise<string> {
  // Fetch latest active template version from DB
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

  // Fallback to hardcoded templates
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
  if (channel !== "whatsapp") {
    await supabase
      .from("communications")
      .update({ status: "sent", external_message_id: `MSG-${Date.now()}`, sent_at: new Date().toISOString() })
      .eq("id", commId);
    return;
  }

  const { watiProvider } = await import("./providers/wati");
  
  if (watiProvider.isEnabled()) {
    const result = await watiProvider.send({
      phoneNumber,
      templateName,
      bodyParams: [{ name: "body", value: body }],
    });

    if (result.status === "sent") {
      await supabase
        .from("communications")
        .update({ status: "sent", external_message_id: result.id, sent_at: new Date().toISOString() })
        .eq("id", commId);

      setTimeout(async () => {
        await supabase
          .from("communications")
          .update({ status: "delivered", delivered_at: new Date().toISOString() })
          .eq("id", commId);
      }, 3000);
    } else {
      await handleRetry(commId);
    }
  } else {
    await simulateSend(commId, channel, body);
  }
}
async function simulateSend(commId: string, channel: string, body: string): Promise<void> {
  // Simulate sending delay
  await new Promise(resolve => setTimeout(resolve, 200));

  // Update to sent
  await supabase
    .from("communications")
    .update({
      status: "sent",
      external_message_id: `MSG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sent_at: new Date().toISOString(),
    })
    .eq("id", commId);

  // Simulate delivery (80% delivered, 15% read, 5% failed)
  await new Promise(resolve => setTimeout(resolve, 500));
  const random = Math.random();

  if (random < 0.05) {
    // Failed — retry
    await handleRetry(commId);
  } else if (random < 0.20) {
    // Delivered only
    await supabase
      .from("communications")
      .update({ status: "delivered", delivered_at: new Date().toISOString() })
      .eq("id", commId);
  } else {
    // Delivered + Read
    await supabase
      .from("communications")
      .update({ status: "delivered", delivered_at: new Date().toISOString() })
      .eq("id", commId);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    await supabase
      .from("communications")
      .update({ status: "read", read_at: new Date().toISOString() })
      .eq("id", commId);
  }
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
    // Retry
    await supabase
      .from("communications")
      .update({
        status: "queued",
        retry_count: retryCount,
      })
      .eq("id", commId);

    // Simulate retry delay then send again
    await new Promise(resolve => setTimeout(resolve, 2000));
    await simulateSend(commId, "whatsapp", "");
  } else {
    // Max retries reached — mark as failed
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

// Health dashboard data
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

// Tenant communication timeline
export async function getTenantTimeline(tenantId: string, limit: number = 20) {
  const { data } = await supabase
    .from("communications")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return data || [];
}