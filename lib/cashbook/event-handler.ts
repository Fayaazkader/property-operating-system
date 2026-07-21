// lib/cashbook/event-handler.ts
// Cash Book Event Handler — Subscribes to allocation events, triggers posting service

import { subscribe } from '@/lib/platform/events/event-bus';
import { cashbookPostingService } from './posting-service';
import { logger } from '@/lib/platform/events/logger.service';

let initialized = false;

export function initializeCashBookEvents(): void {
  if (initialized) return;
  initialized = true;

  // React to allocation completion — post to ledger
  subscribe('cashbook.allocation.completed', async (event) => {
    const { transactionId } = event.payload;
    logger.info('Allocation completed, posting to ledger', { transactionId });
    await cashbookPostingService.postTransaction(transactionId);
  });

  logger.info('Cash Book event handlers initialized');
}
