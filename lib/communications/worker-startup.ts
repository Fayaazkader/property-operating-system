// lib/communications/worker-startup.ts
// Starts the worker only when running as a dedicated worker process.
// In development, the worker runs in the web process for simplicity.
// In production, this should be a separate process/container.

import { communicationsWorker } from './queue-worker';

export function startWorker(): void {
  // Only start if not running in a web request context
  // In production: start via a separate entry point or cron job
  // In development: start alongside the web server for convenience
  const isWorker = process.env.WORKER_PROCESS === 'true' || process.env.NODE_ENV === 'development';
  
  if (isWorker) {
    communicationsWorker.start();
    console.log('📨 Communications Worker started');
  }
}
