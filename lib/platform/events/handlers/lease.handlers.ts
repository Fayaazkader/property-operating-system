// lib/platform/events/handlers/lease.handlers.ts
// Lease domain event handlers

import { subscribe, publish } from '../event-bus';
import { logger } from '../logger.service';
import { Events } from '../events';
import { LeaseExecutedPayload, LeaseActivatedPayload, LeaseExpiringPayload } from '../contract';

subscribe<LeaseExecutedPayload>(Events.Lease.Executed, async (event) => {
  const { leaseId, executionId, executedAt } = event.payload;
  logger.info('📄 Lease executed', { leaseId, executionId, executedAt, eventId: event.eventId });

  await publish('notification.requested', {
    correlationId: event.correlationId,
    source: 'lease-handler',
    version: '1.0',
    payload: {
      event: 'lease.executed',
      recipient: event.entity?.tenantId || event.actor?.id || 'system',
      recipient_type: 'tenant',
      data: { leaseId, executedAt, link: `/leasing/${leaseId}` },
    },
  });
});

subscribe<LeaseActivatedPayload>(Events.Lease.Activated, async (event) => {
  const { leaseId, intakeId, monthlyRental } = event.payload;
  logger.info('✅ Lease activated', { leaseId, intakeId, monthlyRental, eventId: event.eventId });

  await publish('notification.requested', {
    correlationId: event.correlationId,
    source: 'lease-handler',
    version: '1.0',
    payload: {
      event: 'lease.activated',
      recipient: event.entity?.tenantId || event.actor?.id || 'system',
      recipient_type: 'tenant',
      data: { leaseId, monthlyRental, link: `/leasing/${leaseId}` },
    },
  });
});

subscribe<LeaseExpiringPayload>(Events.Lease.Expiring, async (event) => {
  const { leaseId, tenantId, daysRemaining } = event.payload;
  logger.info('⚠️ Lease expiring', { leaseId, tenantId, daysRemaining, eventId: event.eventId });

  await publish('notification.requested', {
    correlationId: event.correlationId,
    source: 'lease-handler',
    version: '1.0',
    payload: {
      event: 'lease.expiring',
      recipient: tenantId,
      recipient_type: 'tenant',
      data: { leaseId, daysRemaining, link: `/leasing/${leaseId}` },
      priority: 'high',
    },
  });
});
