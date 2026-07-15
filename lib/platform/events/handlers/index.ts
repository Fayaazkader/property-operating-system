// lib/platform/events/handlers/index.ts
// Import and register all domain event handlers

import './lease.handlers';
import './vacancy.handlers';
import './brokerage.handlers';
import './property.handlers';

// Export all handlers
export * from './lease.handlers';
export * from './vacancy.handlers';
export * from './brokerage.handlers';
export * from './property.handlers';
