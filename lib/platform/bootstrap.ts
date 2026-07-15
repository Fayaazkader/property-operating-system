// lib/platform/bootstrap.ts
// Platform Initialization — Single entry point for all platform services
// Called once on import from app/layout.tsx

import { logger } from './events/logger.service';

let initialized = false;

async function initializePlatform(): Promise<void> {
  if (initialized) return;
  
  // Prevent duplicate initialization in dev mode (React Strict Mode double-mount)
  if (typeof globalThis !== 'undefined' && (globalThis as any).__platformInitialized) return;
  if (typeof globalThis !== 'undefined') (globalThis as any).__platformInitialized = true;

  logger.info('🚀 Initializing AssetFlow Platform...');

  // 1. Import event handlers — registers all domain event subscribers
  await import('./events/handlers');
  logger.info('  ✓ Event handlers registered');

  // 2. Initialize Notification Engine — subscribes to notification.requested
  const { notificationEngine } = await import('./notifications/engine');
  await notificationEngine.initialize();
  logger.info('  ✓ Notification Engine initialized');

  // 3. Import notification handlers — routes domain events to notification.requested
  await import('./notifications/handlers');
  logger.info('  ✓ Notification handlers registered');

  // 4. Future platform services (uncomment as built):
  // const { automationEngine } = await import('./automation/engine');
  // await automationEngine.initialize();
  // logger.info('  ✓ Automation Engine initialized');
  //
  // const { jobScheduler } = await import('./jobs/scheduler');
  // await jobScheduler.initialize();
  // logger.info('  ✓ Job Scheduler initialized');

  initialized = true;
  logger.info('✅ AssetFlow Platform initialized');
}

// Auto-execute on import
initializePlatform().catch((error) => {
  logger.error('❌ Platform initialization failed:', error);
});

export { initializePlatform };
