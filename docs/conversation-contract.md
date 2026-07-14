# Conversation Contract

## Architecture
User (Any Channel)
↓
Conversation Router
↓
┌───────┼───────┬──────────┬──────────┐
│ │ │ │ │
Intent Permission Context Renderer
│ │ │ │ │
└───────┼───────┴──────────┴──────────┘
↓
Domain Engine
↓
┌───────┼───────┬──────────┬──────────┐
│ │ │ │ │
Revenue Execution Reporting Search Notification
│ │ │ │ │
└───────┴───────┴──────────┴──────────┘
↓
Response (Channel-Formatted)
↓
User

## Request Contract

```typescript
interface ConversationRequest {
  // Who is asking
  userId: string;
  tenantId?: string;
  propertyId?: string;
  entityId: string;
  role: 'tenant' | 'property_manager' | 'finance' | 'executive';
  
  // What they said
  message: string;
  channel: 'whatsapp' | 'search' | 'morning-brief' | 'web' | 'mobile';
  
  // Context
  sessionId?: string;
  conversationId: string;
  correlationId: string;
  
  // Metadata
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
}
interface ConversationResponse {
  // Status
  success: boolean;
  status: 'success' | 'error' | 'escalated' | 'needs_clarification';
  
  // Content
  message: string;
  cards?: {
    title: string;
    status: string;
    details: { label: string; value: string }[];
    actions?: { label: string; action: string }[];
  }[];
  actions?: { label: string; action: string }[];
  
  // Channel-Specific Formatting
  channel: {
    whatsapp?: {
      buttons?: { label: string; action: string }[];
    };
    web?: {
      view?: 'card' | 'table' | 'list';
    };
  };
  
  // Audit
  correlationId: string;
  timestamp: string;
  durationMs: number;
}
interface Dispatcher {
  route(request: ConversationRequest): Promise<ConversationResponse>;
}

// Engines that implement Dispatcher:
// - RevenueEngine
// - ExecutionEngine
// - ReportingEngine
// - SearchEngine
// - NotificationEngine