// lib/periods/event-delivery.ts
// Event delivery with retry and dead-letter tracking

import { publish } from '@/lib/platform/events/event-bus';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/platform/events/logger.service';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

export async function publishWithRetry(
  eventName: string,
  payload: any,
  retries = MAX_RETRIES
): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await publish(eventName, payload);
      return true;
    } catch (error) {
      logger.warn(`Event publish attempt ${attempt}/${retries} failed for ${eventName}`, { error });
      
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
      } else {
        // Dead letter — all retries exhausted
        await supabase.from('dead_letter_events').insert({
          event_name: eventName,
          payload,
          error: error instanceof Error ? error.message : 'Unknown error',
          retries_exhausted: retries,
          created_at: new Date().toISOString(),
        });
        logger.error(`Event ${eventName} moved to dead letter after ${retries} attempts`);
        return false;
      }
    }
  }
  return false;
}

// Replay dead-letter events
export async function replayDeadLetters(limit = 10): Promise<{ replayed: number; failed: number }> {
  const { data: pending } = await supabase
    .from('dead_letter_events')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (!pending?.length) return { replayed: 0, failed: 0 };

  let replayed = 0, failed = 0;

  for (const event of pending) {
    try {
      await publish(event.event_name, event.payload);
      await supabase.from('dead_letter_events').update({ status: 'replayed' }).eq('id', event.id);
      replayed++;
    } catch {
      await supabase.from('dead_letter_events').update({ status: 'failed_retry' }).eq('id', event.id);
      failed++;
    }
  }

  return { replayed, failed };
}
