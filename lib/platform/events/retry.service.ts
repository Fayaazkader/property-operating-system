// lib/platform/events/retry.service.ts
// Retry Worker — Background processing for failed events

import { supabase } from "@/lib/supabase";
import { publish } from './event-bus';
import { updateEventStatus } from './telemetry.service';
import { moveToDeadLetter } from './dead-letter.service';
import { logger } from './logger.service';

const MAX_RETRIES = 3;
const RETRY_BATCH_SIZE = 10;

export async function processRetries(): Promise<void> {
  logger.info('🔄 Retry worker started');

  try {
    const { data: failedEvents, error } = await supabase
      .from('event_logs')
      .select('*')
      .eq('status', 'failed')
      .lt('retry_count', MAX_RETRIES)
      .order('created_at', { ascending: true })
      .limit(RETRY_BATCH_SIZE);

    if (error) {
      logger.error('Failed to fetch failed events:', { error });
      return;
    }

    if (!failedEvents || failedEvents.length === 0) {
      logger.info('No failed events to retry');
      return;
    }

    logger.info(`🔄 Retrying ${failedEvents.length} failed events`);

    for (const event of failedEvents) {
      const retryCount = (event.retry_count || 0) + 1;

      try {
        await updateEventStatus(event.event_id, 'retrying', { retryCount });

        await publish(event.event_name, {
          correlationId: event.correlation_id || crypto.randomUUID(),
          source: 'retry-worker',
          version: event.version || '1.0',
          payload: event.payload || {},
          metadata: { retryCount },
        });

        await updateEventStatus(event.event_id, 'completed');

        logger.info(`✅ Retry successful for event ${event.event_name}`, {
          eventId: event.event_id,
          retryCount,
        });

      } catch (error) {
        logger.error(`❌ Retry failed for event ${event.event_name}:`, {
          eventId: event.event_id,
          retryCount,
          error,
        });

        if (retryCount >= MAX_RETRIES) {
          await moveToDeadLetter({
            eventId: event.event_id,
            eventName: event.event_name,
            correlationId: event.correlation_id,
            payload: event.payload,
            attempts: retryCount,
            reason: 'Max retries exceeded',
          });
          await updateEventStatus(event.event_id, 'dead_letter');
        } else {
          await supabase
            .from('event_logs')
            .update({
              retry_count: retryCount,
              updated_at: new Date().toISOString(),
            })
            .eq('event_id', event.event_id);
        }
      }
    }

  } catch (error) {
    logger.error('Retry worker error:', { error });
  }
}
