// lib/platform/events/handlers/brokerage.handlers.ts
// Brokerage Event Handlers — Logging only
// NOTIFICATION ROUTING: lib/platform/notifications/handlers/index.ts

import { subscribe } from '../event-bus';
import { logger } from '../logger.service';

subscribe('vacancy.created', async (event) => {
  logger.info('📊 Vacancy created', { vacancyId: event.entity?.id, propertyId: event.payload?.property_id });
});

subscribe('broker.offer.accepted', async (event) => {
  logger.info('📄 Offer accepted', { offerId: event.entity?.id, vacancyId: event.payload?.vacancyId });
});

subscribe('broker.commission.approved', async (event) => {
  logger.info('💰 Commission approved', { commissionId: event.entity?.id, amount: event.payload?.amount });
});
