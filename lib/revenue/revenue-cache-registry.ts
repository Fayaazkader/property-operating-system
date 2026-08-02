// lib/revenue/revenue-cache-registry.ts
// Registers event listeners for cache invalidation. Called once at bootstrap.

import { subscribe } from '@/lib/platform/events/event-bus';
import { RevenueCache } from './revenue-cache';

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
    subscribe(event, (e: any) => {
      const p = e?.payload || {};
      RevenueCache.invalidate(p.entityId || p.entity_id, p.propertyId || p.property_id, p.periodId || p.period_id);
    });
  }
}
