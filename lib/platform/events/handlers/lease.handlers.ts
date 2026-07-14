// lib/platform/events/handlers/lease.handlers.ts
// Lease domain event handlers

import { subscribe } from '../event-bus';
import { logger } from '../logger.service';
import { LeaseExecutedPayload, LeaseActivatedPayload, LeaseExpiringPayload } from '../contract';

subscribe('lease.executed', async (event) => {
  const payload = event.payload as LeaseExecutedPayload;
  logger.info('📄 Lease executed', {
    leaseId: payload.leaseId,
    executionId: payload.executionId,
    eventId: event.eventId,
  });
  // TODO: Trigger revenue operations (only if you want revenue on execution)
});

subscribe('lease.activated', async (event) => {
  const payload = event.payload as LeaseActivatedPayload;
  logger.info('✅ Lease activated', {
    leaseId: payload.leaseId,
    intakeId: payload.intakeId,
    monthlyRental: payload.monthlyRental,
    eventId: event.eventId,
  });
  // TODO: Start billing
  // 1. Create billing rules
  // 2. Generate first invoice
  // 3. Update Morning Brief
  // 4. Notify tenant
});

subscribe('lease.expiring', async (event) => {
  const payload = event.payload as LeaseExpiringPayload;
  logger.info('⚠️ Lease expiring', {
    leaseId: payload.leaseId,
    tenantId: payload.tenantId,
    daysRemaining: payload.daysRemaining,
    eventId: event.eventId,
  });
  // TODO: Send expiring notification
  // TODO: Create renewal opportunity
});
