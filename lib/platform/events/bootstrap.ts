// lib/platform/events/bootstrap.ts
// Single registration point for all event handlers

import './handlers';
import { logger } from './logger.service';

let isRegistered = false;

export function registerEventHandlers(): void {
  if (isRegistered) {
    logger.warn('Event handlers already registered, skipping duplicate registration');
    return;
  }
  isRegistered = true;
  logger.info('✅ Event handlers registered');
}
