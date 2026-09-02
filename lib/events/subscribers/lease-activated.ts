// lib/events/subscribers/lease-activated.ts
// Downstream domain reactions to the canonical lease.activated platform event

import { subscribe } from "@/lib/platform/events/event-bus";
import { Events } from "@/lib/platform/events/events";
import { supabase } from "@/lib/supabase";

type LeaseActivatedOperationalPayload = {
  lease_id: string;
  intake_id: string;
  tenant_id: string;
  property_id: string;
  unit_id: string;
  monthly_rental: number;
  deposit_amount: number;
  commencement_date: string;
  expiry_date?: string | null;
  escalation_percent: number;
  parking_bays: number;
  tenant_name: string;
  company_registration?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  entity_id?: string | null;
  broker_id?: string | null;
  broker_company?: string | null;
  commercial_terms: {
    monthly_rental: number;
    deposit_amount: number;
    escalation_percent: number;
    parking_bays: number;
    lease_term_months: number;
  };
  initiated_by: string;
  occurred_at: string;
};


// 3. Communications
subscribe<LeaseActivatedOperationalPayload>(
  Events.Lease.Activated,
  async (event) => {
    const data = event.payload;

    console.log(
      `[Communications] Processing notifications for lease ${data.lease_id}`
    );

    if (!data.tenant_id) {
      console.log(
        `[Communications] No tenant ID available for lease ${data.lease_id}`
      );
      return;
    }

    const { data: tenant } = await supabase
      .from("tenants")
      .select(
        "whatsapp_number, whatsapp_enabled, email, email_enabled, tenant_name"
      )
      .eq("id", data.tenant_id)
      .single();

    if (!tenant) {
      console.error(
        `[Communications] Tenant ${data.tenant_id} not found`
      );
      return;
    }

    if (tenant.whatsapp_enabled && tenant.whatsapp_number) {
      console.log(
        `[Communications] WhatsApp notification eligible for ${tenant.tenant_name}`
      );
    }

    if (tenant.email_enabled && tenant.email) {
      console.log(
        `[Communications] Email notification eligible for ${tenant.tenant_name}`
      );
    }

    console.log(
      `[Communications] Notification processing completed for lease ${data.lease_id}`
    );
  }
);

// 4. Reports
subscribe<LeaseActivatedOperationalPayload>(
  Events.Lease.Activated,
  async (event) => {
    const data = event.payload;

    console.log(
      `[Reports] Rent roll update triggered for ${data.tenant_name} at ${data.monthly_rental}`
    );
  }
);

// 5. Morning Brief
subscribe<LeaseActivatedOperationalPayload>(
  Events.Lease.Activated,
  async (event) => {
    const data = event.payload;

    console.log(
      `[Morning Brief] New lease activated for ${data.tenant_name}`
    );
  }
);

// 6. Broker
subscribe<LeaseActivatedOperationalPayload>(
  Events.Lease.Activated,
  async (event) => {
    const data = event.payload;

    if (data.broker_id) {
      console.log(
        `[Broker] Commission eligibility: Lease ${data.lease_id} by broker ${data.broker_id}`
      );
    }
  }
);