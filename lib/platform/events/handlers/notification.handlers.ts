// lib/platform/events/handlers/notification.handlers.ts
// Notification domain event handlers

import { subscribe } from '../event-bus';
import { logger } from '../logger.service';
import { MaintenanceCompletedPayload } from '../contract';

subscribe('maintenance.completed', async (event) => {
  const payload = event.payload as MaintenanceCompletedPayload;
  logger.info('🔧 Maintenance completed', {
    ticketId: payload.ticketId,
    tenantId: payload.tenantId,
    completedAt: payload.completedAt,
    eventId: event.eventId,
  });
  // TODO: Notify tenant
  // TODO: Close work order
});
