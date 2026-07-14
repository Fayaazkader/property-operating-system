// lib/conversation/contract.ts
// Conversation Contract — Every channel uses this

export interface ConversationRequest {
  // Who is asking
  userId?: string;
  tenantId?: string;
  propertyId?: string;
  entityId: string;
  role: 'tenant' | 'property_manager' | 'finance' | 'executive' | 'unknown';

  // What they said
  message: string;
  channel: 'whatsapp' | 'search' | 'morning-brief' | 'web' | 'mobile';

  // Channel-specific metadata
  channelMetadata: {
    messageId?: string;
    from?: string;
    mediaUrls?: string[];
    provider?: string;
    direction?: 'inbound' | 'outbound';
  };

  // Context
  sessionId?: string;
  conversationId: string;
  correlationId: string;

  // Metadata
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ConversationResponse {
  // Status
  success: boolean;
  status: 'success' | 'error' | 'escalated' | 'needs_clarification' | 'pending';

  // Content
  message: string;
  cards?: {
    title: string;
    status: string;
    details: { label: string; value: string }[];
    actions?: { label: string; action: string }[];
  }[];

  // Next steps
  nextSteps?: string[];

  // Channel-specific formatting
  channelFormat: {
    whatsapp?: {
      buttons?: { label: string; action: string }[];
      list?: { title: string; description: string }[];
    };
    web?: {
      view?: 'card' | 'table' | 'list';
      action?: 'navigate' | 'open' | 'execute';
    };
  };

  // Audit
  correlationId: string;
  timestamp: string;
  durationMs: number;
}

export interface ConversationContext {
  id: string;
  tenantId: string;
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
