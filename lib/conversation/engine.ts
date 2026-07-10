import { supabase } from "@/lib/supabase";

// ============================================================
// TYPES
// ============================================================
export type ConversationContext = {
  sessionId?: string;
  tenantId: string;
  tenantName: string;
  tenantRole: string;
  lastIntent?: string;
  lastQuery?: string;
  pendingDocuments: string[];
  openTickets: string[];
  awaitingConfirmation: boolean;
};

export type IntentResult = {
  intent: string;
  confidence: number;
  entities: Record<string, string>;
  requiresClarification: boolean;
  clarificationQuestion?: string;
  requiredRole: "tenant" | "property_manager" | "finance" | "executive" | "any";
};

export type ServiceResponse = {
  reply: string;
  confidence: number;
  requiresHumanReview: boolean;
  data?: any;
  action?: "reply" | "escalate" | "handoff" | "workflow";
  workflowCard?: {
    title: string;
    status: string;
    details: { label: string; value: string }[];
  };
};

// ============================================================
// CONTEXT MANAGEMENT (Database-backed)
// ============================================================
export async function getContext(tenantId: string, tenantName: string, tenantRole: string = "tenant"): Promise<ConversationContext> {
  const { data: session } = await supabase.from("conversation_sessions").select("*").eq("tenant_id", tenantId).eq("status", "active").order("created_at", { ascending: false }).limit(1).single();

  if (session) {
    return {
      sessionId: session.id,
      tenantId,
      tenantName,
      tenantRole,
      lastIntent: session.last_intent,
      lastQuery: session.last_query,
      pendingDocuments: session.session_data?.pendingDocuments || [],
      openTickets: session.session_data?.openTickets || [],
      awaitingConfirmation: session.session_data?.awaitingConfirmation || false,
    };
  }

  const { data: newSession } = await supabase.from("conversation_sessions").insert({ tenant_id: tenantId, session_data: { pendingDocuments: [], openTickets: [], awaitingConfirmation: false } }).select("id").single();

  return {
    sessionId: newSession?.id,
    tenantId, tenantName, tenantRole,
    pendingDocuments: [], openTickets: [], awaitingConfirmation: false,
  };
}

export async function updateContext(context: ConversationContext, intent: string, query: string): Promise<void> {
  if (!context.sessionId) return;
  await supabase.from("conversation_sessions").update({
    last_intent: intent,
    last_query: query,
    session_data: {
      pendingDocuments: context.pendingDocuments,
      openTickets: context.openTickets,
      awaitingConfirmation: context.awaitingConfirmation,
    },
    updated_at: new Date().toISOString(),
  }).eq("id", context.sessionId);
}

// ============================================================
// PERMISSION ENGINE
// ============================================================
const roleHierarchy: Record<string, number> = {
  tenant: 1,
  property_manager: 2,
  finance: 3,
  executive: 4,
};

export function checkPermission(userRole: string, requiredRole: string): boolean {
  if (requiredRole === "any") return true;
  return (roleHierarchy[userRole] || 0) >= (roleHierarchy[requiredRole] || 0);
}

// ============================================================
// INTENT CLASSIFICATION (with confidence)
// ============================================================
export async function classifyIntent(message: string, context: ConversationContext): Promise<IntentResult> {
  const msg = message.toLowerCase().trim();
  const entities: Record<string, string> = {};

  const amountMatch = msg.match(/r\s*(\d[\d\s,]*)/i);
  if (amountMatch) entities.amount = amountMatch[1].replace(/[\s,]/g, "");

  // Context-aware follow-ups (high confidence)
  if (context.lastIntent === "maintenance_request" && !msg.includes("photo")) {
    if (msg.includes("yes") || msg.includes("send") || msg.includes("here")) {
      return { intent: "maintenance_photo", confidence: 95, entities, requiresClarification: false, requiredRole: "tenant" };
    }
  }

  if (context.lastIntent === "balance_enquiry" && (msg.includes("why") || msg.includes("explain"))) {
    return { intent: "bill_explanation", confidence: 95, entities, requiresClarification: false, requiredRole: "tenant" };
  }

  if (context.lastIntent === "statement_request" && (msg.includes("last month") || msg.includes("previous"))) {
    return { intent: "statement_request", confidence: 95, entities, requiresClarification: false, requiredRole: "tenant" };
  }

  if (context.awaitingConfirmation && (msg === "yes" || msg === "yeah" || msg === "confirm")) {
    return { intent: "confirm_action", confidence: 98, entities, requiresClarification: false, requiredRole: "any" };
  }

  // Primary intents with confidence scores
  if (/statement|send statement|get statement/i.test(msg)) return { intent: "statement_request", confidence: 97, entities, requiresClarification: false, requiredRole: "tenant" };
  if (/balance|what do i owe|how much do i owe|outstanding/i.test(msg)) return { intent: "balance_enquiry", confidence: 97, entities, requiresClarification: false, requiredRole: "tenant" };
  if (/lease|expir|when.*lease/i.test(msg)) return { intent: "lease_enquiry", confidence: 95, entities, requiresClarification: false, requiredRole: "tenant" };
  if (/payment.*received|did you receive|has.*payment.*allocated/i.test(msg)) return { intent: "payment_allocation", confidence: 90, entities, requiresClarification: false, requiredRole: "tenant" };
  if (/next payment|when.*pay|due date|payment due/i.test(msg)) return { intent: "next_payment_due", confidence: 88, entities, requiresClarification: false, requiredRole: "tenant" };
  if (/maintenance|leak|broken|repair|fix|not working|stopped/i.test(msg)) return { intent: "maintenance_request", confidence: 94, entities, requiresClarification: true, clarificationQuestion: "Could you send a photo? It helps us assess urgency and assign the right contractor.", requiredRole: "tenant" };
  if (/send.*lease|lease.*document|lease.*pdf|copy.*lease/i.test(msg)) return { intent: "lease_document", confidence: 92, entities, requiresClarification: false, requiredRole: "tenant" };
  if (/why.*higher|why.*more|explain.*charge|bill.*higher/i.test(msg)) return { intent: "bill_explanation", confidence: 85, entities, requiresClarification: false, requiredRole: "tenant" };
  if (/deposit|deposit amount|deposit held/i.test(msg)) return { intent: "deposit_enquiry", confidence: 90, entities, requiresClarification: false, requiredRole: "tenant" };
  if (/renew|renewal|extend.*lease/i.test(msg)) return { intent: "renewal_request", confidence: 88, entities, requiresClarification: false, requiredRole: "tenant" };
  if (/bank.*details|how.*pay|payment.*method|banking/i.test(msg)) return { intent: "banking_details", confidence: 92, entities, requiresClarification: false, requiredRole: "tenant" };
  if (/office hours|open.*when|what time/i.test(msg)) return { intent: "office_hours", confidence: 97, entities, requiresClarification: false, requiredRole: "tenant" };
  if (/emergency|urgent|flood|fire|danger/i.test(msg)) return { intent: "emergency", confidence: 100, entities, requiresClarification: false, requiredRole: "tenant" };
  if (/help|talk.*human|speak.*agent|contact.*manager/i.test(msg)) return { intent: "escalation", confidence: 100, entities, requiresClarification: false, requiredRole: "tenant" };

  // Property Manager intents
  if (/morning brief|portfolio|what changed|overnight/i.test(msg)) return { intent: "portfolio_brief", confidence: 90, entities, requiresClarification: false, requiredRole: "property_manager" };
  if (/expiring|renewal.*due|leases.*expir/i.test(msg)) return { intent: "expiring_leases", confidence: 92, entities, requiresClarification: false, requiredRole: "property_manager" };
  if (/occupancy|vacant|vacancy/i.test(msg)) return { intent: "occupancy_query", confidence: 92, entities, requiresClarification: false, requiredRole: "property_manager" };
  if (/arrears|who owes|outstanding.*tenant/i.test(msg)) return { intent: "arrears_query", confidence: 90, entities, requiresClarification: false, requiredRole: "property_manager" };

  // Finance intents
  if (/revenue|income.*month|billing.*summary/i.test(msg)) return { intent: "revenue_query", confidence: 88, entities, requiresClarification: false, requiredRole: "finance" };
  if (/unallocated|reconcile|bank.*balance/i.test(msg)) return { intent: "cashbook_query", confidence: 88, entities, requiresClarification: false, requiredRole: "finance" };

  return { intent: "unknown", confidence: 0, entities, requiresClarification: false, requiredRole: "any" };
}

// ============================================================
// SERVICE FUNCTIONS (with confidence & workflow cards)
// ============================================================
function formatRands(amount: number): string {
  if (!amount || isNaN(amount)) return "R0.00";
  return `R${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
}

export async function handleBalanceEnquiry(tenantId: string, tenantName: string, supabaseClient: any): Promise<ServiceResponse> {
  const { getTenantBalance } = await import("@/lib/intelligence/tenant-balance");
  const { getTenantSummary } = await import("@/lib/intelligence/tenant-summary");
  const balance = await getTenantBalance(supabaseClient, tenantId);
  const summary = await getTenantSummary(supabaseClient, tenantId);

  return {
    reply: `💰 Balance Breakdown\n\nCurrent Charges: ${formatRands(balance.current_charges)}\nReceipts: ${formatRands(balance.receipts)}\nBalance Due: ${formatRands(balance.balance_cf)}\n\nLease: ${summary?.property_name || "Active"}`,
    confidence: 99,
    requiresHumanReview: false,
    data: balance,
    workflowCard: {
      title: "Balance Summary",
      status: balance.balance_cf > 0 ? "Outstanding" : "Settled",
      details: [
        { label: "Current Charges", value: formatRands(balance.current_charges) },
        { label: "Receipts", value: formatRands(balance.receipts) },
        { label: "Balance Due", value: formatRands(balance.balance_cf) },
      ],
    },
  };
}

export async function handleStatementRequest(tenantId: string, supabaseClient: any): Promise<ServiceResponse> {
  const { getTenantStatements } = await import("@/lib/intelligence/tenant-statements");
  const { getTenantSummary } = await import("@/lib/intelligence/tenant-summary");
  const statements = await getTenantStatements(supabaseClient, tenantId, 3);
  const summary = await getTenantSummary(supabaseClient, tenantId);

  if (statements.length > 0) {
    return {
      reply: `📄 Statements\n\nLatest: ${statements[0].period} — ${formatRands(summary?.current_balance || 0)}\n\nPrevious:\n${statements.slice(1).map(s => `• ${s.period}`).join("\n")}\n\nView: https://assetflow.africa`,
      confidence: 99,
      requiresHumanReview: false,
      data: statements,
    };
  }
  return { reply: "No statements yet.", confidence: 99, requiresHumanReview: false };
}

export async function handleLeaseEnquiry(tenantId: string, supabaseClient: any): Promise<ServiceResponse> {
  const { getTenantSummary } = await import("@/lib/intelligence/tenant-summary");
  const summary = await getTenantSummary(supabaseClient, tenantId);

  if (summary?.expiry_date) {
    const daysRemaining = Math.ceil((new Date(summary.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return {
      reply: `🏢 Lease Info\n\nProperty: ${summary.property_name}\nExpiry: ${new Date(summary.expiry_date).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}\nRemaining: ${daysRemaining} days\n\nReply "renew" to start renewal.`,
      confidence: 97,
      requiresHumanReview: false,
      data: summary,
      workflowCard: {
        title: "Lease Details",
        status: daysRemaining > 180 ? "Secure" : daysRemaining > 90 ? "Monitor" : "Action Required",
        details: [
          { label: "Property", value: summary.property_name || "—" },
          { label: "Expiry", value: new Date(summary.expiry_date).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" }) },
          { label: "Remaining", value: `${daysRemaining} days` },
        ],
      },
    };
  }
  return { reply: "No active lease found.", confidence: 97, requiresHumanReview: false };
}

export async function handlePaymentAllocation(tenantId: string, supabaseClient: any): Promise<ServiceResponse> {
  const { getTenantPayments } = await import("@/lib/intelligence/tenant-payments");
  const payments = await getTenantPayments(supabaseClient, tenantId, 5);

  if (payments.length > 0) {
    const recent = payments[0];
    const daysAgo = Math.ceil((Date.now() - new Date(recent.date).getTime()) / (1000 * 60 * 60 * 24));
    return {
      reply: `💳 Payment Status\n\nLast Payment: ${formatRands(recent.amount)}\nDate: ${recent.date}\nStatus: Allocated ✅\n\n${daysAgo <= 3 ? `Received ${daysAgo} day(s) ago.` : ""}`,
      confidence: 95,
      requiresHumanReview: false,
      data: payments,
      workflowCard: {
        title: "Payment Status",
        status: "Allocated",
        details: [
          { label: "Amount", value: formatRands(recent.amount) },
          { label: "Date", value: recent.date },
          { label: "Reference", value: recent.reference },
        ],
      },
    };
  }
  return { reply: "No payments recorded yet. Bank imports checked daily.", confidence: 95, requiresHumanReview: false };
}

export async function handleMaintenanceRequest(
  tenantId: string, tenantName: string, message: string, mediaUrls: string[], summary: any
): Promise<ServiceResponse> {
  const ticketId = `MNT-${Date.now().toString(36).toUpperCase()}`;

  await supabase.from("tasks").insert({
    tenant_id: tenantId,
    title: `Maintenance: ${message.slice(0, 100)}`,
    description: `WhatsApp request from ${tenantName}${summary?.property_name ? ` at ${summary.property_name}` : ""}.${mediaUrls.length > 0 ? `\n\nPhotos: ${mediaUrls.join(", ")}` : ""}`,
    status: "open",
    priority: message.toLowerCase().includes("emergency") || message.toLowerCase().includes("urgent") ? "high" : "medium",
    source: "whatsapp",
    due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  });

  return {
    reply: `🔧 Maintenance Logged\n\nTicket: ${ticketId}\nPriority: ${message.toLowerCase().includes("emergency") ? "🔴 Emergency" : "🟡 Standard"}\n${mediaUrls.length > 0 ? `Photos: ${mediaUrls.length} attached ✅` : ""}\n\nExpected response: ${message.toLowerCase().includes("emergency") ? "Within 2 hours" : "Within 24 hours"}`,
    confidence: 96,
    requiresHumanReview: message.toLowerCase().includes("emergency"),
    action: "workflow",
    workflowCard: {
      title: "Maintenance Request",
      status: "Open",
      details: [
        { label: "Ticket", value: ticketId },
        { label: "Priority", value: message.toLowerCase().includes("emergency") ? "Emergency" : "Standard" },
        { label: "Property", value: summary?.property_name || "Your property" },
        { label: "Photos", value: `${mediaUrls.length} attached` },
      ],
    },
  };
}

export async function handleRenewalRequest(tenantId: string, message: string, summary: any): Promise<ServiceResponse> {
  await supabase.from("communications").insert({
    tenant_id: tenantId, event_type: "renewal_request", channel: "whatsapp",
    message_body: message, status: "escalated", severity: "medium",
    source_type: "whatsapp", source_id: `RNW-${Date.now()}`,
  });

  return {
    reply: `🔄 Renewal Requested\n\nLease expires ${summary?.expiry_date ? new Date(summary.expiry_date).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" }) : "soon"}.\n\nYour property manager will contact you to discuss terms.\n\nProperty: ${summary?.property_name || "Active"}`,
    confidence: 90,
    requiresHumanReview: true,
    action: "escalate",
  };
}

export async function handleEmergency(tenantId: string, message: string): Promise<ServiceResponse> {
  await supabase.from("communications").insert({
    tenant_id: tenantId, event_type: "emergency", channel: "whatsapp",
    message_body: message, status: "escalated", severity: "critical",
    source_type: "whatsapp", source_id: `EMG-${Date.now()}`,
  });

  return {
    reply: `🚨 EMERGENCY — Help is on the way.\n\nYour message has been escalated as critical.\n\nIf life-threatening:\n📞 10111 (Police)\n📞 10177 (Ambulance)\n📞 112 (Cellphone)`,
    confidence: 100,
    requiresHumanReview: true,
    action: "escalate",
  };
}
