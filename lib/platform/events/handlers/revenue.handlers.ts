// lib/platform/events/handlers/revenue.handlers.ts
// Revenue domain event handlers

import { subscribe } from '../event-bus';
import { logger } from '../logger.service';
import { Events } from '../events';
import { StatementGeneratedPayload, PaymentReceivedPayload } from '../contract';

subscribe<StatementGeneratedPayload>(Events.Statement.Generated, async (event) => {
  const { statementId, tenantId, amount } = event.payload;
  logger.info('📄 Statement generated', {
    statementId,
    tenantId,
    amount,
    eventId: event.eventId,
  });
});

subscribe<PaymentReceivedPayload>(Events.Payment.Received, async (event) => {
  const { paymentId, tenantId, amount, reference } = event.payload;
  logger.info('💳 Payment received', {
    paymentId,
    tenantId,
    amount,
    reference,
    eventId: event.eventId,
  });
});
