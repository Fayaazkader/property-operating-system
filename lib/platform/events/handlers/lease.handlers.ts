// lib/platform/events/handlers/lease.handlers.ts
// Lease domain event handlers

import { subscribe } from '../event-bus';
import { logger } from '../logger.service';
import { Events } from '../events';
import { LeaseExecutedPayload, LeaseActivatedPayload, LeaseExpiringPayload } from '../contract';

subscribe<LeaseExecutedPayload>(Events.Lease.Executed, async (event) => {
  const { leaseId, executionId, executedAt } = event.payload;
  logger.info('📄 Lease executed', {
    leaseId,
    executionId,
    executedAt,
    eventId: event.eventId,
  });
});

subscribe<LeaseActivatedPayload>(Events.Lease.Activated, async (event) => {
  const { leaseId, intakeId, monthlyRental } = event.payload;
  logger.info('✅ Lease activated', {
    leaseId,
    intakeId,
    monthlyRental,
    eventId: event.eventId,
  });
});

subscribe<LeaseExpiringPayload>(Events.Lease.Expiring, async (event) => {
  const { leaseId, tenantId, daysRemaining } = event.payload;
  logger.info('⚠️ Lease expiring', {
    leaseId,
    tenantId,
    daysRemaining,
    eventId: event.eventId,
  });
});