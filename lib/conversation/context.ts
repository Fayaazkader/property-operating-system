// lib/conversation/context.ts
// Conversation Context Management

import { supabase } from "@/lib/supabase";

export interface ConversationContext {
  id: string;
  tenantId: string;
  status: 'active' | 'expired' | 'closed';
  
  // Conversation state
  lastIntent?: string;
  lastQuery?: string;
  currentEntity?: {
    type: 'property' | 'lease' | 'tenant' | 'invoice';
    id: string;
  };
  
  // User context
  selectedPropertyId?: string;
  selectedTenantId?: string;
  selectedLeaseId?: string;
  
  // Conversation history
  history: {
    query: string;
    intent: string;
    timestamp: string;
  }[];
  
  // Context data
  context: Record<string, any>;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export async function getOrCreateContext(
  tenantId: string,
  initialContext: Record<string, any> = {}
): Promise<ConversationContext | null> {
  try {
    // Check for existing active context
    const { data: existing } = await supabase
      .from('conversation_sessions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existing) {
      return {
        id: existing.id,
        tenantId: existing.tenant_id,
        status: existing.status,
        lastIntent: existing.last_intent,
        lastQuery: existing.last_query,
        currentEntity: existing.session_data?.currentEntity,
        selectedPropertyId: existing.session_data?.selectedPropertyId,
        selectedTenantId: existing.session_data?.selectedTenantId,
        selectedLeaseId: existing.session_data?.selectedLeaseId,
        history: existing.session_data?.history || [],
        context: existing.session_data || {},
        createdAt: existing.created_at,
        updatedAt: existing.updated_at,
        expiresAt: existing.expires_at,
      };
    }

    // Create new context
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const { data: newSession, error } = await supabase
      .from('conversation_sessions')
      .insert({
        tenant_id: tenantId,
        status: 'active',
        session_data: { history: [], ...initialContext },
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error || !newSession) {
      console.error('Failed to create context:', error);
      return null;
    }

    return {
      id: newSession.id,
      tenantId: newSession.tenant_id,
      status: newSession.status,
      history: [],
      context: initialContext,
      createdAt: newSession.created_at,
      updatedAt: newSession.updated_at,
      expiresAt: newSession.expires_at,
    };
  } catch (error) {
    console.error('Context error:', error);
    return null;
  }
}

export async function updateContext(
  contextId: string,
  updates: {
    lastIntent?: string;
    lastQuery?: string;
    currentEntity?: { type: string; id: string };
    selectedPropertyId?: string;
    selectedTenantId?: string;
    selectedLeaseId?: string;
    history?: { query: string; intent: string; timestamp: string }[];
    context?: Record<string, any>;
    status?: 'active' | 'expired' | 'closed';
  }
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('conversation_sessions')
      .update({
        last_intent: updates.lastIntent,
        last_query: updates.lastQuery,
        session_data: {
          currentEntity: updates.currentEntity,
          selectedPropertyId: updates.selectedPropertyId,
          selectedTenantId: updates.selectedTenantId,
          selectedLeaseId: updates.selectedLeaseId,
          history: updates.history,
          ...updates.context,
        },
        status: updates.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contextId);

    if (error) {
      console.error('Failed to update context:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Context update error:', error);
    return false;
  }
}

export async function closeContext(contextId: string): Promise<boolean> {
  return updateContext(contextId, { status: 'closed' });
}

export function addToHistory(
  context: ConversationContext,
  query: string,
  intent: string
): ConversationContext {
  return {
    ...context,
    history: [
      ...context.history,
      { query, intent, timestamp: new Date().toISOString() },
    ].slice(-10), // Keep last 10 conversations
  };
}