// Event Bus — enables proactive conversations
// When a lease is signed, payment allocated, or statement generated, the platform can notify tenants

type EventPayload = {
  event: string;
  tenantId?: string;
  propertyId?: string;
  data: Record<string, any>;
};

type EventHandler = (payload: EventPayload) => Promise<void>;

const handlers: Map<string, EventHandler[]> = new Map();

export function subscribe(event: string, handler: EventHandler) {
  if (!handlers.has(event)) handlers.set(event, []);
  handlers.get(event)!.push(handler);
}

export async function publish(event: string, payload: EventPayload) {
  const eventHandlers = handlers.get(event) || [];
  for (const handler of eventHandlers) {
    await handler(payload).catch(err => console.error(`Event handler error for ${event}:`, err));
  }
}

// Register platform events
subscribe("statement_generated", async (payload) => {
  if (!payload.tenantId) return;
  // Send proactive WhatsApp notification
  const { supabase } = await import("@/lib/supabase");
  const { data: tenant } = await supabase.from("tenants").select("whatsapp_number, whatsapp_enabled, tenant_name").eq("id", payload.tenantId).single();
  if (tenant?.whatsapp_enabled && tenant.whatsapp_number) {
    // Queue proactive message via Twilio
    console.log(`Proactive: Statement ready for ${tenant.tenant_name}`);
  }
});

subscribe("lease_expiring_soon", async (payload) => {
  if (!payload.tenantId) return;
  console.log(`Proactive: Lease expiring notification for tenant ${payload.tenantId}`);
});

subscribe("payment_received", async (payload) => {
  if (!payload.tenantId) return;
  console.log(`Proactive: Payment confirmation for tenant ${payload.tenantId}`);
});

subscribe("maintenance_completed", async (payload) => {
  if (!payload.tenantId) return;
  console.log(`Proactive: Maintenance completed notification for tenant ${payload.tenantId}`);
});
