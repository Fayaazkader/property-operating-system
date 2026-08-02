// lib/platform/bootstrap.ts
// Platform Initialization — Single entry point for all platform services

import { logger } from './events/logger.service';

let initialized = false;

async function initializePlatform(): Promise<void> {
  if (initialized) return;
  if (typeof globalThis !== 'undefined' && (globalThis as any).__platformInitialized) return;
  if (typeof globalThis !== 'undefined') (globalThis as any).__platformInitialized = true;

  logger.info('🚀 Initializing AssetFlow Platform...');

  await import('./events/handlers');
  logger.info('  ✓ Event handlers registered');

  const { notificationEngine } = await import('./notifications/engine');
  await notificationEngine.initialize();
  logger.info('  ✓ Notification Engine initialized');

  await import('./notifications/handlers');

  // Register workflow handlers
  const { registerInitialBillingHandler } = await import('@/lib/workflow/handlers/initial-billing-handler');
  registerInitialBillingHandler();
  logger.info('  ✓ Initial billing handler registered');
  logger.info('  ✓ Notification handlers registered');

  const { automationEngine } = await import('./automation/engine');
  await automationEngine.initialize();
  const { initializeCashBookEvents } = await import('../cashbook/event-handler');
  initializeCashBookEvents();
  logger.info('  ✓ Cash Book events initialized');

  logger.info('  ✓ Automation Engine initialized');

  initialized = true;
  logger.info('✅ AssetFlow Platform initialized');
}

initializePlatform().catch((error) => {
  logger.error('❌ Platform initialization failed:', error);
});

export { initializePlatform };
