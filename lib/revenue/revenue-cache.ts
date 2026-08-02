// lib/revenue/revenue-cache.ts
// Structured cache for Revenue Context. No string parsing.

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

  invalidate(entityId?: string, propertyId?: string, periodId?: string): void {
    for (const [key, entry] of cache) {
      if (entityId && entry.entityId === entityId) { cache.delete(key); continue; }
      if (propertyId && entry.propertyId === propertyId) { cache.delete(key); continue; }
      if (periodId && (entry.statementPeriodId === periodId || entry.financialPeriodId === periodId)) { cache.delete(key); continue; }
    }
  },

  clear(): void {
    cache.clear();
  }
};
