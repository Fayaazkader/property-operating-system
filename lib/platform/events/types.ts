// lib/platform/events/types.ts
// Event Bus Type Definitions — Uses PlatformEvent Contract

import { PlatformEvent } from './contract';

// Re-export the contract types
export type { PlatformEvent } from './contract';

// Event handler type — generic for strong typing
export type EventHandler<T = any> = (event: PlatformEvent<T>) => Promise<void>;

// Telemetry type
export interface EventTelemetry {
  eventId: string;
  correlationId: string;
  eventName: string;
  handlerName: string;
  success: boolean;
  durationMs: number;
  timestamp: string;
  error?: string;
  retryCount?: number;
}

// Event status
export type EventStatus = 'received' | 'processing' | 'completed' | 'failed' | 'retrying' | 'dead_letter';
