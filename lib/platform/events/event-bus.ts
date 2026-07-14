// lib/platform/events/event-bus.ts
// Lightweight Event Bus — publishes only, no persistence, no retries

import { EventContract, EventHandler } from './types';
import { logger } from './logger.service';

const handlers: Map<string, EventHandler[]> = new Map();

export function subscribe(eventName: string, handler: EventHandler): void {
  if (!handlers.has(eventName)) {
    handlers.set(eventName, []);
  }
  handlers.get(eventName)!.push(handler);
  logger.debug(`Handler registered for event: ${eventName}`);
}

export async function publish(
  eventName: string,
  event: Omit<EventContract, 'eventId' | 'timestamp' | 'eventName'>
): Promise<void> {
  const eventId = crypto.randomUUID();
  const correlationId = event.correlationId || crypto.randomUUID();
  const timestamp = new Date().toISOString();

  const fullEvent: EventContract = {
    ...event,
    eventId,
    correlationId,
    eventName,
    timestamp,
  };

  logger.info(`📡 Publishing event: ${eventName}`, {
    eventId,
    correlationId,
    source: event.source,
  });

  const eventHandlers = handlers.get(eventName) || [];

  if (eventHandlers.length === 0) {
    logger.warn(`No handlers registered for event: ${eventName}`, { eventId, correlationId });
    return;
  }

  const results = await Promise.allSettled(
    eventHandlers.map(async (handler) => {
      const startTime = performance.now();
      try {
        await handler(fullEvent);
        return { success: true, duration: performance.now() - startTime };
      } catch (error) {
        return { success: false, duration: performance.now() - startTime, error };
      }
    })
  );

  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      if (result.value.success) {
        successCount++;
      } else {
        failureCount++;
        logger.error(`Handler failed for event ${eventName}:`, {
          eventId,
          correlationId,
          error: result.value.error?.message || 'Unknown error',
        });
      }
    } else {
      failureCount++;
      logger.error(`Handler rejected for event ${eventName}:`, {
        eventId,
        correlationId,
        error: result.reason?.message || 'Unknown error',
      });
    }
  }

  logger.info(`✅ Event ${eventName} processed`, {
    eventId,
    correlationId,
    successCount,
    failureCount,
    totalHandlers: eventHandlers.length,
  });
}
