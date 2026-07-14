// lib/platform/events/handlers/revenue.handlers.ts
// Revenue domain event handlers

import { subscribe } from '../event-bus';
import { logger } from '../logger.service';
import { StatementGeneratedPayload, PaymentReceivedPayload } from '../contract';

subscribe('statement.generated', async (event) => {
  const payload = event.payload as StatementGeneratedPayload;
  logger.info('📄 Statement generated', {
    statementId: payload.statementId,
    tenantId: payload.tenantId,
    period: payload.period,
    amount: payload.amount,
    eventId: event.eventId,
  });
  // TODO: Send statement notification via Email/WhatsApp
});

subscribe('payment.received', async (event) => {
  const payload = event.payload as PaymentReceivedPayload;
  logger.info('💳 Payment received', {
    paymentId: payload.paymentId,
    tenantId: payload.tenantId,
    amount: payload.amount,
    reference: payload.reference,
    eventId: event.eventId,
  });
  // TODO: Update ledger
  // TODO: Send payment confirmation
  // TODO: Update Morning Brief
});
