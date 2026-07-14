// lib/platform/events/dead-letter.service.ts
// Dead Letter Queue Service

import { supabase } from "@/lib/supabase";
import { logger } from './logger.service';

export interface DeadLetterItem {
  eventId: string;
  eventName: string;
  correlationId?: string;
  payload: Record<string, any>;
  attempts: number;
  reason: string;
}

export async function moveToDeadLetter(item: DeadLetterItem): Promise<void> {
  try {
    await supabase.from('dead_letter_queue').insert({
      event_id: item.eventId,
      event_name: item.eventName,
      correlation_id: item.correlationId,
      payload: item.payload,
      attempts: item.attempts,
      reason: item.reason,
      created_at: new Date().toISOString(),
    });

    logger.warn(`💀 Event moved to dead letter queue: ${item.eventName}`, {
      eventId: item.eventId,
      attempts: item.attempts,
      reason: item.reason,
    });
  } catch (error) {
    logger.error(`Failed to move event to dead letter queue:`, { error });
  }
}

export async function requeueFromDeadLetter(deadLetterId: string): Promise<void> {
  try {
    const { data: item, error } = await supabase
      .from('dead_letter_queue')
      .select('*')
      .eq('id', deadLetterId)
      .single();

    if (error || !item) {
      logger.error(`Failed to find dead letter item: ${deadLetterId}`, { error });
      return;
    }

    const { publish } = await import('./event-bus');
    await publish(item.event_name, {
      correlationId: item.correlation_id || crypto.randomUUID(),
      source: 'dead-letter-requeue',
      version: '1.0',
      payload: item.payload || {},
      metadata: { requeuedFromDeadLetter: true },
    });

    await supabase
      .from('dead_letter_queue')
      .delete()
      .eq('id', deadLetterId);

    logger.info(`📤 Requeued event from dead letter: ${item.event_name}`, {
      deadLetterId,
      eventId: item.event_id,
    });
  } catch (error) {
    logger.error(`Failed to requeue from dead letter:`, { error });
  }
}
