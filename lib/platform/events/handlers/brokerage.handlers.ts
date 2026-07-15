// lib/platform/events/handlers/brokerage.handlers.ts
// Brokerage Event Handlers

import { subscribe, publish } from '../event-bus';
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

  await publish('notification.requested', {
    correlationId: event.correlationId,
    source: 'brokerage-handler',
    version: '1.0',
    payload: {
      event: 'broker.offer.accepted',
      recipient: payload.tenantId || 'system',
      recipient_type: 'tenant',
      data: {
        offerId: event.entity?.id,
        vacancyId: payload.vacancyId,
        link: `/brokerage/offers/${event.entity?.id}`,
      },
    },
  });
});

subscribe('broker.commission.approved', async (event) => {
  const payload = event.payload || {};
  logger.info('💰 Commission approved — preparing payment request', {
    commissionId: event.entity?.id,
    amount: payload.amount,
  });

  await publish('notification.requested', {
    correlationId: event.correlationId,
    source: 'brokerage-handler',
    version: '1.0',
    payload: {
      event: 'broker.commission.approved',
      recipient: payload.brokerId || 'system',
      recipient_type: 'broker',
      data: {
        commissionId: event.entity?.id,
        amount: payload.amount,
        link: `/brokerage/commissions/${event.entity?.id}`,
      },
    },
  });
});
