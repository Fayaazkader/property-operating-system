// lib/platform/events/index.ts

// Core exports
export * from './types';
export * from './contract';
export * from './event-bus';
export * from './telemetry.service';
export * from './logger.service';
export * from './retry.service';
export * from './dead-letter.service';

// Handler registration
export * from './handlers';

// Convenience exports
export { publish, subscribe } from './event-bus';
export { logEvent, updateEventStatus, recordTelemetry } from './telemetry.service';
export { processRetries } from './retry.service';
export { moveToDeadLetter, requeueFromDeadLetter } from './dead-letter.service';
