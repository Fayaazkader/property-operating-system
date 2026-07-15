// lib/platform/events/handlers/brokerage.handlers.ts
// Brokerage Event Handlers

import { subscribe } from '../event-bus';
import { logger } from '../logger.service';
import { Events } from '../events';

// When a vacancy is created, update Morning Brief
subscribe(Events.Vacancy.Created, async (event) => {
  logger.info('📊 Vacancy created — updating portfolio stats', {
    vacancyId: event.entity?.id,
    propertyId: event.payload?.property_id,
  });
});

// When an offer is accepted, trigger Execution Engine
subscribe(Events.Broker.OfferAccepted, async (event) => {
  logger.info('📄 Offer accepted — ready for execution', {
    offerId: event.entity?.id,
    vacancyId: event.payload?.vacancyId,
  });
});

// When commission is approved, notify Disbursement Operations
subscribe(Events.Broker.CommissionApproved, async (event) => {
  logger.info('💰 Commission approved — preparing payment request', {
    commissionId: event.entity?.id,
    amount: event.payload?.amount,
  });
});

// When work order is created
subscribe(Events.WorkOrder.Created, async (event) => {
  logger.info('🔧 Work order created', {
    workOrderId: event.entity?.id,
    propertyId: event.payload?.propertyId,
    priority: event.payload?.priority,
  });
});

// When work order is completed
subscribe(Events.WorkOrder.Completed, async (event) => {
  logger.info('✅ Work order completed', {
    workOrderId: event.entity?.id,
    propertyId: event.payload?.propertyId,
  });
});

// When inspection is completed
subscribe(Events.Inspection.Completed, async (event) => {
  logger.info('📋 Inspection completed', {
    inspectionId: event.entity?.id,
    propertyId: event.payload?.propertyId,
  });
});
