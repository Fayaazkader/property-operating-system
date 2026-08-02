// lib/revenue/revenue-cache-registry.ts
// Registers event listeners for cache invalidation. Called once at bootstrap.

import { subscribe } from '@/lib/platform/events/event-bus';
import { RevenueCache } from './revenue-cache';

interface RevenueEventPayload {
  entityId?: string;
  entity_id?: string;
  propertyId?: string;
  property_id?: string;
  periodId?: string;
  period_id?: string;
}

interface RevenueEvent {
  payload?: RevenueEventPayload;
}

let registered = false;

const EVENTS = [
  'lease.activated', 'lease.updated',
  'billing.rule.updated', 'billing.rule.created',
  'charge.manual_added', 'charge.updated',
  'interest.approved', 'late_fee.approved',
  'document.uploaded', 'document.deleted',
  'period.statement.closed', 'period.statement.opened',
];

export function registerRevenueCacheInvalidation(): void {
  if (registered) return;
  registered = true;

  for (const event of EVENTS) {
    subscribe(event, async (e: RevenueEvent) => {
      const p = e?.payload || {};
      RevenueCache.invalidateEntity(p.entityId || p.entity_id);
      if (p.propertyId || p.property_id) RevenueCache.invalidateProperty(p.propertyId || p.property_id || '');
      if (p.periodId || p.period_id) RevenueCache.invalidatePeriod(p.periodId || p.period_id || '');
    });
  }
}
