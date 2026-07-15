// lib/platform/notifications/handlers/index.ts
// Notification Engine - Event Subscribers

import { subscribe, publish } from '../../events/event-bus';
import { logger } from '../../events/logger.service';

// ============================================================
// WORK ORDER EVENTS
// ============================================================

subscribe('property.work_order.created', async (event) => {
  const payload = event.payload || {};
  logger.info('📨 Work order created — requesting notification', {
    workOrderId: payload.workOrderId,
  });

  await publish('notification.requested', {
    correlationId: event.correlationId,
    source: 'notification-handler',
    version: '1.0',
    payload: {
      event: 'work.order.created',
      recipient: payload.propertyManagerId,
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
  logger.info('📨 Work order completed — requesting notification', {
    workOrderId: payload.workOrderId,
  });

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
});

subscribe('property.work_order.sla.breached', async (event) => {
  const payload = event.payload || {};
  logger.info('🚨 SLA breached — requesting notification', {
    workOrderId: payload.workOrderId,
  });

  await publish('notification.requested', {
    correlationId: event.correlationId,
    source: 'notification-handler',
    version: '1.0',
    payload: {
      event: 'work.order.sla.breached',
      recipient: payload.propertyManagerId,
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
  logger.info('📨 Inspection completed — requesting notification', {
    inspectionId: payload.inspectionId,
  });

  await publish('notification.requested', {
    correlationId: event.correlationId,
    source: 'notification-handler',
    version: '1.0',
    payload: {
      event: 'inspection.completed',
      recipient: payload.propertyManagerId,
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
  logger.info('📨 Compliance expiring — requesting notification', {
    complianceId: payload.complianceId,
  });

  await publish('notification.requested', {
    correlationId: event.correlationId,
    source: 'notification-handler',
    version: '1.0',
    payload: {
      event: 'compliance.expiring',
      recipient: payload.propertyManagerId,
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
  logger.info('📨 Compliance expired — requesting notification', {
    complianceId: payload.complianceId,
  });

  await publish('notification.requested', {
    correlationId: event.correlationId,
    source: 'notification-handler',
    version: '1.0',
    payload: {
      event: 'compliance.expired',
      recipient: payload.propertyManagerId,
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

subscribe('lease.activated', async (event) => {
  const payload = event.payload || {};
  logger.info('📨 Lease activated — requesting notification', {
    leaseId: payload.leaseId,
  });

  await publish('notification.requested', {
    correlationId: event.correlationId,
    source: 'notification-handler',
    version: '1.0',
    payload: {
      event: 'lease.activated',
      recipient: payload.tenantId,
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

// ============================================================
// COMMISSION EVENTS
// ============================================================

subscribe('broker.commission.approved', async (event) => {
  const payload = event.payload || {};
  logger.info('📨 Commission approved — requesting notification', {
    commissionId: payload.commissionId,
  });

  await publish('notification.requested', {
    correlationId: event.correlationId,
    source: 'notification-handler',
    version: '1.0',
    payload: {
      event: 'commission.approved',
      recipient: payload.brokerId,
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
  logger.info('📨 Payment received — requesting notification', {
    paymentId: payload.paymentId,
  });

  await publish('notification.requested', {
    correlationId: event.correlationId,
    source: 'notification-handler',
    version: '1.0',
    payload: {
      event: 'payment.received',
      recipient: payload.tenantId,
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
