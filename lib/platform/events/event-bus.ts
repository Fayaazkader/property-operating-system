// lib/platform/events/event-bus.ts
// Lightweight Event Bus — publishes only, no persistence, no retries

import { PlatformEvent, EventHandler } from './types';
import { logger } from './logger.service';
import { logEvent, recordTelemetry } from './telemetry.service';

const handlers: Map<string, EventHandler[]> = new Map();

export function subscribe(eventName: string, handler: EventHandler): void {
  if (!handlers.has(eventName)) {
    handlers.set(eventName, []);
  }
  handlers.get(eventName)!.push(handler);
  logger.debug(`Handler registered for event: ${eventName}`);
}

export async function publish<T>(
  eventName: string,
  event: Omit<PlatformEvent<T>, 'eventId' | 'timestamp' | 'eventName'>
): Promise<void> {
  const eventId = crypto.randomUUID();
  const correlationId = event.correlationId || crypto.randomUUID();
  const timestamp = new Date().toISOString();

  const fullEvent: PlatformEvent<T> = {
    ...event,
    eventId,
    correlationId,
    eventName,
    timestamp,
  } as PlatformEvent<T>;

  logger.info(`📡 Publishing event: ${eventName}`, {
    eventId,
    correlationId,
    source: event.source,
  });

  // Log event to database
  await logEvent(fullEvent);

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
        const duration = performance.now() - startTime;
        // Record telemetry for successful handler
        await recordTelemetry({
          eventId,
          correlationId,
          eventName,
          handlerName: handler.name || 'anonymous',
          success: true,
          durationMs: Math.round(duration),
          timestamp: new Date().toISOString(),
        });
        return { success: true, duration };
      } catch (error) {
        const duration = performance.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        // Record telemetry for failed handler
        await recordTelemetry({
          eventId,
          correlationId,
          eventName,
          handlerName: handler.name || 'anonymous',
          success: false,
          durationMs: Math.round(duration),
          timestamp: new Date().toISOString(),
          error: errorMessage,
        });
        return { success: false, duration, error: errorMessage };
      }
    })
  );

  let successCount = 0;
  let failureCount = 0;

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.success) {
      successCount++;
    } else {
      failureCount++;
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
