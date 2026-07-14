// lib/conversation/contract.ts
// Conversation Contract — Every channel uses this

export type ChannelType = 'whatsapp' | 'command' | 'morning-brief' | 'mobile' | 'email' | 'api';

export interface ConversationRequest {
  channel: ChannelType;
  actor?: {
    id: string;
    type: 'user' | 'tenant' | 'system';
    email?: string;
    role?: 'tenant' | 'property_manager' | 'finance' | 'executive' | 'unknown';
  };
  message: string;
  context?: {
    sessionId?: string;
    conversationId: string;
    correlationId: string;
    tenantId?: string;
    propertyId?: string;
    entityId?: string;
    userId?: string;
  };
  channelMetadata?: Record<string, any>;
  timestamp: string;
}

export interface ConversationResponse {
  success: boolean;
  status: 'success' | 'error' | 'escalated' | 'needs_clarification' | 'pending';
  message: string;
  cards?: {
    title: string;
    status: string;
    details: { label: string; value: string }[];
    actions?: { label: string; action: string }[];
  }[];
  nextSteps?: string[];
  channelFormat: {
    whatsapp?: {
      buttons?: { label: string; action: string }[];
    };
    command?: {
      view?: 'card' | 'table' | 'list';
      action?: 'navigate' | 'open' | 'execute';
    };
  };
  correlationId: string;
  timestamp: string;
  durationMs: number;
}

export interface ConversationContext {
  id: string;
  tenantId?: string;
  userId?: string;
  status: 'active' | 'expired' | 'closed';
  lastIntent?: string;
  lastQuery?: string;
  selectedPropertyId?: string;
  selectedTenantId?: string;
  selectedLeaseId?: string;
  history: { query: string; intent: string; timestamp: string }[];
  context: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}
