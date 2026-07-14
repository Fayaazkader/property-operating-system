// lib/platform/events/telemetry.service.ts
// Telemetry Service — Observes events and persists logs

import { supabase } from "@/lib/supabase";
import { PlatformEvent, EventTelemetry } from './types';
import { logger } from './logger.service';

// ============================================================
// LOG EVENT — Persist event to database
// ============================================================

export async function logEvent(event: PlatformEvent): Promise<void> {
  try {
    await supabase.from('event_logs').insert({
      event_id: event.eventId,
      correlation_id: event.correlationId,
      event_name: event.eventName,
      source: event.source,
      version: event.version,
      actor_id: event.actor?.id,
      actor_type: event.actor?.type,
      actor_email: event.actor?.email,
      entity_id: event.entity?.id,
      entity_type: event.entity?.type,
      tenant_id: event.entity?.tenantId,
      property_id: event.entity?.propertyId,
      payload: event.payload,
      metadata: event.metadata,
      status: 'received',
      created_at: event.timestamp,
    });
    logger.debug(`Event logged: ${event.eventName}`, { eventId: event.eventId });
  } catch (error) {
    logger.error(`Failed to log event ${event.eventName}:`, { error });
  }
}

// ============================================================
// UPDATE EVENT STATUS — Update status after processing
// ============================================================

export async function updateEventStatus(
  eventId: string,
  status: 'received' | 'processing' | 'completed' | 'failed' | 'retrying' | 'dead_letter',
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await supabase
      .from('event_logs')
      .update({
        status,
        metadata: metadata ? { ...metadata } : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('event_id', eventId);
  } catch (error) {
    logger.error(`Failed to update event ${eventId} status:`, { error });
  }
}

// ============================================================
// RECORD TELEMETRY — Record handler execution metrics
// ============================================================

export async function recordTelemetry(telemetry: EventTelemetry): Promise<void> {
  try {
    await supabase.from('event_telemetry').insert({
      event_id: telemetry.eventId,
      correlation_id: telemetry.correlationId,
      event_name: telemetry.eventName,
      handler_name: telemetry.handlerName,
      success: telemetry.success,
      duration_ms: telemetry.durationMs,
      error: telemetry.error,
      retry_count: telemetry.retryCount || 0,
      created_at: telemetry.timestamp,
    });
  } catch (error) {
    logger.error(`Failed to record telemetry:`, { error });
  }
}
