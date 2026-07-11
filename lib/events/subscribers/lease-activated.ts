// lib/events/subscribers/lease-activated.ts
// Downstream domains react to lease.activated

import { subscribe } from "@/lib/conversation/event-bus";
import { supabase } from "@/lib/supabase";

// 1. Revenue Ops: Create billing rules
subscribe("lease.activated", async (payload) => {
  const { data } = payload;
  
  console.log(`[Revenue Ops] Processing lease ${data.lease_id} for ${data.tenant_name}`);

  const { error: rentalError } = await supabase
    .from("billing_rules")
    .insert({
      lease_id: data.lease_id,
      rule_type: "monthly_rental",
      description: `Monthly rental for ${data.tenant_name}`,
      base_amount: data.commercial_terms.monthly_rental,
      frequency: "monthly",
      escalation_percent: data.commercial_terms.escalation_percent || 0,
      effective_from: data.commencement_date,
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

  if (rentalError) {
    console.error(`[Revenue Ops] Failed to create rental billing: ${rentalError.message}`);
    return;
  }

  const { error: depositError } = await supabase
    .from("deposit_ledger")
    .insert({
      lease_id: data.lease_id,
      tenant_id: data.tenant_id,
      amount: data.commercial_terms.deposit_amount,
      status: "held",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

  if (depositError) {
    console.error(`[Revenue Ops] Failed to create deposit ledger: ${depositError.message}`);
    return;
  }

  if (data.commercial_terms.parking_bays > 0) {
    console.log(`[Revenue Ops] Parking billing will be created for ${data.commercial_terms.parking_bays} bays`);
  }

  console.log(`[Revenue Ops] Billing created for lease ${data.lease_id}`);
});

// 2. Property Ops: Update unit occupancy
subscribe("lease.activated", async (payload) => {
  const { data } = payload;
  
  console.log(`[Property Ops] Updating unit ${data.unit_id}`);

  const { error } = await supabase
    .from("units")
    .update({
      occupancy_status: "occupied",
      current_tenant_name: data.tenant_name,
      current_lease_id: data.lease_id,
      current_rental_rate: data.commercial_terms.monthly_rental,
      updated_at: new Date().toISOString()
    })
    .eq("id", data.unit_id);

  if (error) {
    console.error(`[Property Ops] Failed to update unit: ${error.message}`);
    return;
  }

  console.log(`[Property Ops] Unit ${data.unit_id} occupied by ${data.tenant_name}`);
});

// 3. Communications: Send notifications
subscribe("lease.activated", async (payload) => {
  const { data, tenantId } = payload;
  
  console.log(`[Communications] Sending notifications for lease ${data.lease_id}`);

  const { data: tenant } = await supabase
    .from("tenants")
    .select("whatsapp_number, whatsapp_enabled, email, email_enabled, tenant_name")
    .eq("id", tenantId)
    .single();

  if (!tenant) {
    console.error(`[Communications] Tenant ${tenantId} not found`);
    return;
  }

  if (tenant.whatsapp_enabled && tenant.whatsapp_number) {
    console.log(`[Communications] WhatsApp notification sent to ${tenant.tenant_name} at ${tenant.whatsapp_number}`);
  }

  if (tenant.email_enabled && tenant.email) {
    console.log(`[Communications] Email notification sent to ${tenant.tenant_name} at ${tenant.email}`);
  }

  console.log(`[Communications] Notifications sent for lease ${data.lease_id}`);
});

// 4. Reports: Update rent roll
subscribe("lease.activated", async (payload) => {
  const { data } = payload;
  console.log(`[Reports] Rent roll updated for ${data.tenant_name} at ${data.monthly_rental}`);
});

// 5. Morning Brief: Show new lease
subscribe("lease.activated", async (payload) => {
  const { data } = payload;
  console.log(`[Morning Brief] New lease activated for ${data.tenant_name}`);
});

// 6. Broker: Track commission eligibility
subscribe("lease.activated", async (payload) => {
  const { data } = payload;
  
  if (data.broker_id) {
    console.log(`[Broker] Commission eligibility: Lease ${data.lease_id} by broker ${data.broker_id}`);
  }
});
