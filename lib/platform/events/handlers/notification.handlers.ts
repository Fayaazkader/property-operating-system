// lib/platform/events/handlers/notification.handlers.ts
// Notification domain event handlers

import { subscribe } from '../event-bus';
import { logger } from '../logger.service';
import { Events } from '../events';
import { MaintenanceCompletedPayload } from '../contract';

subscribe<MaintenanceCompletedPayload>(Events.Maintenance.Completed, async (event) => {
  const { ticketId, tenantId, completedAt } = event.payload;
  logger.info('🔧 Maintenance completed', {
    ticketId,
    tenantId,
    completedAt,
    eventId: event.eventId,
  });
});
