// lib/platform/events/handlers/audit.handlers.ts
// Audit handlers — catches all events

import { subscribe } from '../event-bus';
import { logger } from '../logger.service';

// Catch-all handler for audit logging
subscribe('*', async (event) => {
  logger.debug('📋 Audit: Event processed', {
    eventName: event.eventName,
    eventId: event.eventId,
    correlationId: event.correlationId,
    source: event.source,
    actor: event.actor?.id,
    entity: event.entity?.id,
  });
});
