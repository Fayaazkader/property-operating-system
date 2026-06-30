import { supabase } from "@/lib/supabase";

type EventMetadata = Record<string, any>;

export async function trackEvent(eventName: string, module?: string, metadata?: EventMetadata) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("product_events").insert({
      user_id: user?.id || null,
      event_name: eventName,
      module: module || null,
      metadata: metadata || {},
    });
  } catch {
    // Analytics should never break the app — fail silently
  }
}

// Common events
export const AnalyticsEvents = {
  // Auth
  LOGIN: "login",
  LOGOUT: "logout",
  SIGNUP: "signup",

  // Navigation
  PAGE_VIEW: "page_view",
  SEARCH: "search",
  COMMAND_PALETTE_OPEN: "command_palette_open",

  // Tenant Operations
  TENANT_VIEW: "tenant_view",
  TENANT_SEARCH: "tenant_search",

  // Property Operations
  PROPERTY_VIEW: "property_view",

  // Revenue Ops
  STATEMENT_GENERATED: "statement_generated",
  BILLING_RUN: "billing_run",

  // Cash Book
  BANK_IMPORT: "bank_import",
  TRANSACTION_ALLOCATED: "transaction_allocated",
  TRANSACTIONS_POSTED: "transactions_posted",

  // Communications
  COMMUNICATION_SENT: "communication_sent",
  WHATSAPP_RECEIVED: "whatsapp_received",
  WHATSAPP_RESPONDED: "whatsapp_responded",

  // Tasks
  TASK_CREATED: "task_created",
  TASK_COMPLETED: "task_completed",

  // Feedback
  FEEDBACK_SUBMITTED: "feedback_submitted",
};
