// lib/cashbook/event-handler.ts
// Cash Book Event Handler
// Allocation completion does NOT automatically post.
// Posting requires an explicit governed posting action.

import { subscribe } from '@/lib/platform/events/event-bus';
import { logger } from '@/lib/platform/events/logger.service';

let initialized = false;

export function initializeCashBookEvents(): void {
  if (initialized) return;
  initialized = true;

  subscribe('cashbook.allocation.completed', async (event) => {
    const { transactionId, allocationStatus } = event.payload;

    logger.info('Cash Book allocation completed', {
      transactionId,
      allocationStatus,
    });
  });

  logger.info('Cash Book event handlers initialized');
}