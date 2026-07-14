// lib/conversation/platform.ts
// Conversation Platform — Orchestrates all conversations

import { supabase } from "@/lib/supabase";
import { publish, Events } from "@/lib/platform/events";
import { logger } from "@/lib/platform/events/logger.service";
import { ConversationRequest, ConversationResponse, ConversationContext } from './contract';
import { getOrCreateContext, updateContext, addToHistory } from './context';
import { intentRegistry } from './intent-registry';
import { transitionState, getStatePrompt } from './state-machine';

export class ConversationPlatform {
  private supabase = supabase;

  async process(request: ConversationRequest): Promise<ConversationResponse> {
    const startTime = performance.now();
    const correlationId = request.correlationId || crypto.randomUUID();

    logger.info(`💬 Processing conversation request`, {
      correlationId,
      channel: request.channel,
      message: request.message.substring(0, 50),
    });

    try {
      // 1. Resolve tenant
      const tenant = await this.resolveTenant(request);

      // 2. Get or create context
      let context = await getOrCreateContext(tenant?.id || 'unknown', {
        userId: request.userId,
        entityId: request.entityId,
        role: request.role || 'tenant',
      });

      if (!context) {
        throw new Error('Failed to create conversation context');
      }

      // 3. Classify intent
      const intentResult = intentRegistry.classify(request.message, request.role || 'tenant');

      // 4. Check permissions
      if (intentResult.intent) {
        const hasPermission = this.checkPermission(request.role || 'tenant', intentResult.intent.roles[0]);
        if (!hasPermission) {
          logger.warn(`Permission denied for user ${request.userId} on intent ${intentResult.intent.id}`, {
            correlationId,
          });
          return this.buildResponse({
            success: false,
            status: 'error',
            message: "You don't have permission to perform this action.",
            correlationId,
            startTime,
            channel: request.channel,
          });
        }
      }

      // 5. Update state machine
      const newState = transitionState(
        context.status === 'active' ? 'idle' : 'idle',
        intentResult.intent?.id || 'unknown',
        context.context
      );

      // 6. Execute the intent
      let reply = "I'm not sure how to help with that.";
      let cards: ConversationResponse['cards'] = undefined;

      if (intentResult.intent && intentResult.confidence > 70) {
        const handler = await this.getIntentHandler(intentResult.intent.id);
        if (handler) {
          const result = await handler(request, context);
          reply = result.reply;
          cards = result.cards;
        }
      }

      // 7. Update context with history
      context = addToHistory(context, request.message, intentResult.intent?.id || 'unknown');
      await updateContext(context.id, {
        lastIntent: intentResult.intent?.id,
        lastQuery: request.message,
        history: context.history,
        context: context.context,
      });

      // 8. Store communication
      await this.storeCommunication(request, tenant, intentResult.intent?.id || 'unknown');

      // 9. Publish event
      await this.publishEvent(request, tenant, intentResult.intent?.id || 'unknown', 'success');

      // 10. Build response
      return this.buildResponse({
        success: true,
        status: 'success',
        message: reply,
        cards,
        correlationId,
        startTime,
        channel: request.channel,
        context,
      });

    } catch (error) {
      logger.error('Conversation platform error:', { error, correlationId });

      // Publish failure event
      await this.publishEvent(request, null, 'unknown', 'error', error);

      return this.buildResponse({
        success: false,
        status: 'error',
        message: "I'm sorry, we're experiencing technical difficulties. Please try again later.",
        correlationId,
        startTime,
        channel: request.channel,
      });
    }
  }

  // ============================================================
  // RESOLVE TENANT
  // ============================================================

  private async resolveTenant(request: ConversationRequest): Promise<any> {
    if (request.tenantId) {
      const { data } = await this.supabase
        .from('tenants')
        .select('id, tenant_name, entity_id')
        .eq('id', request.tenantId)
        .single();
      return data;
    }

    if (request.channelMetadata?.from) {
      const { data } = await this.supabase
        .from('tenants')
        .select('id, tenant_name, entity_id')
        .eq('whatsapp_number', request.channelMetadata.from)
        .single();
      return data;
    }

    return null;
  }

  // ============================================================
  // PERMISSION CHECK
  // ============================================================

  private checkPermission(userRole: string, requiredRole: string): boolean {
    const hierarchy: Record<string, number> = {
      tenant: 1,
      property_manager: 2,
      finance: 3,
      executive: 4,
      unknown: 0,
    };

    return (hierarchy[userRole] || 0) >= (hierarchy[requiredRole] || 0);
  }

  // ============================================================
  // INTENT HANDLER
  // ============================================================

  private async getIntentHandler(intentId: string): Promise<any> {
    // Map intent to handler
    const handlers: Record<string, any> = {
      'balance_enquiry': 'handleBalanceEnquiry',
      'statement_request': 'handleStatementRequest',
      'lease_enquiry': 'handleLeaseEnquiry',
      // Add more as needed
    };

    const handlerName = handlers[intentId];
    if (!handlerName) return null;

    const { engine } = await import('./engine');
    return engine[handlerName] || null;
  }

  // ============================================================
  // STORE COMMUNICATION
  // ============================================================

  private async storeCommunication(
    request: ConversationRequest,
    tenant: any,
    intent: string
  ): Promise<void> {
    try {
      await this.supabase.from('communications').insert({
        tenant_id: tenant?.id,
        event_type: `${request.channel}_inbound`,
        channel: request.channel,
        message_body: request.message,
        status: 'received',
        source_type: request.channel,
        source_id: request.channelMetadata?.messageId,
        external_message_id: request.channelMetadata?.messageId,
        media_urls: request.channelMetadata?.mediaUrls,
        intent: intent,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to store communication:', { error });
    }
  }

  // ============================================================
  // PUBLISH EVENT
  // ============================================================

  private async publishEvent(
    request: ConversationRequest,
    tenant: any,
    intent: string,
    status: string,
    error?: any
  ): Promise<void> {
    try {
      await publish('conversation.message.processed', {
        correlationId: request.correlationId,
        source: 'conversation-platform',
        version: '1.0',
        actor: tenant?.id ? { id: tenant.id, type: 'tenant' } : undefined,
        entity: tenant?.id ? {
          id: tenant.id,
          type: 'tenant',
          tenantId: tenant.id,
        } : undefined,
        payload: {
          channel: request.channel,
          message: request.message,
          intent,
          status,
          error: error?.message,
          tenantId: tenant?.id,
        },
      });
    } catch (error) {
      logger.error('Failed to publish conversation event:', { error });
    }
  }

  // ============================================================
  // BUILD RESPONSE
  // ============================================================

  private buildResponse(params: {
    success: boolean;
    status: ConversationResponse['status'];
    message: string;
    cards?: ConversationResponse['cards'];
    correlationId: string;
    startTime: number;
    channel: string;
    context?: ConversationContext;
  }): ConversationResponse {
    return {
      success: params.success,
      status: params.status,
      message: params.message,
      cards: params.cards,
      correlationId: params.correlationId,
      timestamp: new Date().toISOString(),
      durationMs: Math.round(performance.now() - params.startTime),
      channelFormat: {},
      nextSteps: [],
    };
  }
}

export const conversationPlatform = new ConversationPlatform();
