// lib/platform/notifications/handlers/index.ts
// Notification Handlers — SINGLE source of truth for notification routing
// Domain handlers do NOT publish notification.requested directly.
// They publish domain events. This file routes them to notifications.

import { subscribe } from '../../events/event-bus';
import { publish } from '../../events/event-bus';
import { logger } from '../../events/logger.service';

// ============================================================
// WORK ORDER EVENTS
// ============================================================

subscribe('property.work_order.created', async (event) => {
  const payload = event.payload || {};
  await publish('notification.requested', {
    correlationId: event.correlationId,
    source: 'notification-handler',
    version: '1.0',
    payload: {
      event: 'work.order.created',
      recipient: payload.propertyManagerId || 'system',
      recipient_type: 'user',
      data: {
        title: payload.title,
        priority: payload.priority,
        propertyName: payload.propertyName,
        description: payload.description,
        link: `/property-operations/work-orders/${payload.workOrderId}`,
      },
    },
  });
});

subscribe('property.work_order.completed', async (event) => {
  const payload = event.payload || {};
  if (payload.tenantId) {
    await publish('notification.requested', {
      correlationId: event.correlationId,
      source: 'notification-handler',
      version: '1.0',
      payload: {
        event: 'work.order.completed',
        recipient: payload.tenantId,
        recipient_type: 'tenant',
        data: {
          title: payload.title,
          propertyName: payload.propertyName,
          completedAt: payload.completedAt,
          link: `/property-operations/work-orders/${payload.workOrderId}`,
        },
      },
    });
  }
});

subscribe('property.work_order.sla.breached', async (event) => {
  const payload = event.payload || {};
  await publish('notification.requested', {
    correlationId: event.correlationId,
    source: 'notification-handler',
    version: '1.0',
    payload: {
      event: 'work.order.sla.breached',
      recipient: payload.propertyManagerId || 'system',
      recipient_type: 'user',
      data: {
        title: payload.title,
        priority: payload.priority,
        propertyName: payload.propertyName,
        createdAt: payload.createdAt,
        link: `/property-operations/work-orders/${payload.workOrderId}`,
      },
      priority: 'high',
    },
  });
});

// ============================================================
// INSPECTION EVENTS
// ============================================================

subscribe('property.inspection.completed', async (event) => {
  const payload = event.payload || {};
  await publish('notification.requested', {
    correlationId: event.correlationId,
    source: 'notification-handler',
    version: '1.0',
    payload: {
      event: 'inspection.completed',
      recipient: payload.propertyManagerId || 'system',
      recipient_type: 'user',
      data: {
        title: payload.title,
        propertyName: payload.propertyName,
        severity: payload.severity,
        completedAt: payload.completedAt,
        link: `/property-operations/inspections/${payload.inspectionId}`,
      },
    },
  });
});

// ============================================================
// COMPLIANCE EVENTS
// ============================================================

subscribe('property.compliance.expiring', async (event) => {
  const payload = event.payload || {};
  await publish('notification.requested', {
    correlationId: event.correlationId,
    source: 'notification-handler',
    version: '1.0',
    payload: {
      event: 'compliance.expiring',
      recipient: payload.propertyManagerId || 'system',
      recipient_type: 'user',
      data: {
        name: payload.name,
        expiryDate: payload.expiryDate,
        propertyName: payload.propertyName,
        link: `/property-operations/compliance/${payload.complianceId}`,
      },
      priority: 'high',
    },
  });
});

subscribe('property.compliance.expired', async (event) => {
  const payload = event.payload || {};
  await publish('notification.requested', {
    correlationId: event.correlationId,
    source: 'notification-handler',
    version: '1.0',
    payload: {
      event: 'compliance.expired',
      recipient: payload.propertyManagerId || 'system',
      recipient_type: 'user',
      data: {
        name: payload.name,
        expiryDate: payload.expiryDate,
        propertyName: payload.propertyName,
        link: `/property-operations/compliance/${payload.complianceId}`,
      },
      priority: 'high',
    },
  });
});

// ============================================================
// LEASE EVENTS
// ============================================================

subscribe('lease.executed', async (event) => {
  const payload = event.payload || {};
  await publish('notification.requested', {
    correlationId: event.correlationId,
    source: 'notification-handler',
    version: '1.0',
    payload: {
      event: 'lease.executed',
      recipient: event.entity?.tenantId || event.actor?.id || 'system',
      recipient_type: 'tenant',
      data: {
        leaseId: payload.leaseId,
        executedAt: payload.executedAt,
        link: `/leasing/${payload.leaseId}`,
      },
    },
  });
});

subscribe('lease.activated', async (event) => {
  const payload = event.payload || {};
  await publish('notification.requested', {
    correlationId: event.correlationId,
    source: 'notification-handler',
    version: '1.0',
    payload: {
      event: 'lease.activated',
      recipient: payload.tenantId || 'system',
      recipient_type: 'tenant',
      data: {
        tenantName: payload.tenantName,
        propertyName: payload.propertyName,
        monthlyRental: payload.monthlyRental,
        commencementDate: payload.commencementDate,
        link: `/leases/${payload.leaseId}`,
      },
    },
  });
});

subscribe('lease.expiring', async (event) => {
  const payload = event.payload || {};
  await publish('notification.requested', {
    correlationId: event.correlationId,
    source: 'notification-handler',
    version: '1.0',
    payload: {
      event: 'lease.expiring',
      recipient: payload.tenantId || 'system',
      recipient_type: 'tenant',
      data: {
        leaseId: payload.leaseId,
        daysRemaining: payload.daysRemaining,
        link: `/leasing/${payload.leaseId}`,
      },
      priority: 'high',
    },
  });
});

// ============================================================
// BROKERAGE EVENTS
// ============================================================

subscribe('broker.offer.accepted', async (event) => {
  const payload = event.payload || {};
  await publish('notification.requested', {
    correlationId: event.correlationId,
    source: 'notification-handler',
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
  await publish('notification.requested', {
    correlationId: event.correlationId,
    source: 'notification-handler',
    version: '1.0',
    payload: {
      event: 'commission.approved',
      recipient: payload.brokerId || 'system',
      recipient_type: 'broker',
      data: {
        brokerName: payload.brokerName,
        leaseRef: payload.leaseRef,
        amount: payload.amount,
        approvedBy: payload.approvedBy,
        link: `/brokerage/commissions/${payload.commissionId}`,
      },
    },
  });
});

// ============================================================
// PAYMENT EVENTS
// ============================================================

subscribe('payment.received', async (event) => {
  const payload = event.payload || {};
  await publish('notification.requested', {
    correlationId: event.correlationId,
    source: 'notification-handler',
    version: '1.0',
    payload: {
      event: 'payment.received',
      recipient: payload.tenantId || 'system',
      recipient_type: 'tenant',
      data: {
        amount: payload.amount,
        tenantName: payload.tenantName,
        reference: payload.reference,
        date: payload.date,
        link: `/financials/payments/${payload.paymentId}`,
      },
    },
  });
});

logger.info('✅ Notification handlers registered');
