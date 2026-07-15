// lib/platform/events/handlers/brokerage.handlers.ts
// Brokerage Event Handlers

import { subscribe } from '../event-bus';
import { logger } from '../logger.service';

subscribe('vacancy.created', async (event) => {
  const payload = event.payload || {};
  logger.info('📊 Vacancy created — updating portfolio stats', {
    vacancyId: event.entity?.id,
    propertyId: payload.property_id,
  });
});

subscribe('broker.offer.accepted', async (event) => {
  const payload = event.payload || {};
  logger.info('📄 Offer accepted — ready for execution', {
    offerId: event.entity?.id,
    vacancyId: payload.vacancyId,
  });
});

subscribe('broker.commission.approved', async (event) => {
  const payload = event.payload || {};
  logger.info('💰 Commission approved — preparing payment request', {
    commissionId: event.entity?.id,
    amount: payload.amount,
  });
});
