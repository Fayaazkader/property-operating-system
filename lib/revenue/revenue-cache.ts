// lib/revenue/revenue-cache.ts
// Structured cache for Revenue Context.

import type { RevenueContext } from './types';

interface CacheEntry {
  entityId: string;
  propertyId: string | null;
  statementPeriodId: string;
  financialPeriodId: string;
  data: RevenueContext;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const TTL = 60000;

function makeKey(entityId: string, propertyId: string | null, statementPeriodId: string, financialPeriodId: string): string {
  return `${entityId}:${propertyId || '*'}:${statementPeriodId}:${financialPeriodId}`;
}

export const RevenueCache = {
  get(entityId: string, propertyId: string | null, statementPeriodId: string, financialPeriodId: string): RevenueContext | null {
    const key = makeKey(entityId, propertyId, statementPeriodId, financialPeriodId);
    const entry = cache.get(key);
    if (entry && Date.now() - entry.timestamp < TTL) return entry.data;
    if (entry) cache.delete(key);
    return null;
  },

  set(entityId: string, propertyId: string | null, statementPeriodId: string, financialPeriodId: string, data: RevenueContext): void {
    const key = makeKey(entityId, propertyId, statementPeriodId, financialPeriodId);
    cache.set(key, { entityId, propertyId, statementPeriodId, financialPeriodId, data, timestamp: Date.now() });
  },

  invalidateEntity(entityId?: string): void {
    if (!entityId) return;
    for (const [key, entry] of cache) {
      if (entry.entityId === entityId) cache.delete(key);
    }
  },

  invalidateProperty(propertyId: string): void {
    for (const [key, entry] of cache) {
      if (entry.propertyId === propertyId) cache.delete(key);
    }
  },

  invalidatePeriod(periodId: string): void {
    for (const [key, entry] of cache) {
      if (entry.statementPeriodId === periodId || entry.financialPeriodId === periodId) cache.delete(key);
    }
  },

  invalidateLease(entityId: string, propertyId: string, leaseId: string): void {
    // TODO: Lease-level invalidation will be introduced once cache entries
    // are keyed by lease. Until then, invalidate the owning entity.
    this.invalidateEntity(entityId);
  },

  clear(): void {
    cache.clear();
  }
};
