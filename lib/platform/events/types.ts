// lib/platform/events/types.ts
// Event Bus Type Definitions — Shared Contract

export interface EventContract {
  // Unique identifiers
  eventId: string;
  correlationId: string;
  
  // Event metadata
  eventName: string;
  version: string;
  source: string;
  
  // Who/what triggered this
  actor?: {
    id: string;
    type: 'user' | 'system' | 'tenant';
    email?: string;
  };
  
  // What entity this relates to
  entity?: {
    id: string;
    type: string;
    tenantId?: string;
    propertyId?: string;
  };
  
  // When it happened
  timestamp: string;
  
  // The actual data
  payload: Record<string, any>;
  
  // Additional metadata
  metadata?: Record<string, any>;
}

export type EventHandler = (event: EventContract) => Promise<void>;

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
