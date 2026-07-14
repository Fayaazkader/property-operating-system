// lib/platform/events/handlers/index.ts
// Import and register all domain event handlers

import './lease.handlers';
import './revenue.handlers';
import './notification.handlers';
import './audit.handlers';

// Export all handlers for potential external use
export * from './lease.handlers';
export * from './revenue.handlers';
export * from './notification.handlers';
export * from './audit.handlers';
