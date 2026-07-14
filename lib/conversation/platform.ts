// lib/conversation/platform.ts
// Conversation Platform — Orchestrates all conversations

import { supabase } from "@/lib/supabase";
import { publish } from "@/lib/platform/events";
import { logger } from "@/lib/platform/events/logger.service";
import { ConversationRequest, ConversationResponse, ConversationContext } from './contract';
import { getOrCreateContext, updateContext, addToHistory } from './context';
import { intentRegistry } from './intent-registry';
import { transitionState } from './state-machine';

export class ConversationPlatform {
  private supabase = supabase;

  async process(request: ConversationRequest): Promise<ConversationResponse> {
    const startTime = performance.now();
    const correlationId = request.context?.correlationId || crypto.randomUUID();

    logger.info(`💬 Processing conversation request`, {
      correlationId,
      channel: request.channel,
      message: request.message.substring(0, 50),
    });

    try {
      // 1. Resolve tenant
      const tenant = await this.resolveTenant(request);

      // 2. Get or create context
      const tenantId = tenant?.id || request.context?.tenantId || 'unknown';
      let context = await getOrCreateContext(tenantId, {
        userId: request.context?.userId,
        entityId: request.context?.entityId,
        role: request.actor?.role || 'tenant',
      });

      if (!context) {
        throw new Error('Failed to create conversation context');
      }

      // 3. Classify intent
      const userRole = request.actor?.role || 'tenant';
      const intentResult = intentRegistry.classify(request.message, userRole);

      // 4. Check permissions
      if (intentResult.intent) {
        const hasPermission = this.checkPermission(userRole, intentResult.intent.roles[0]);
        if (!hasPermission) {
          logger.warn(`Permission denied for user ${request.actor?.id} on intent ${intentResult.intent.id}`, {
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

      // 5. Execute the intent
      let reply = "I'm not sure how to help with that. Could you clarify?";
      let cards: ConversationResponse['cards'] = undefined;

      if (intentResult.intent && intentResult.confidence > 70) {
        const handler = this.getIntentHandler(intentResult.intent.id);
        if (handler) {
          try {
            const summary = await this.getTenantSummary(tenant?.id);
            const intentId = intentResult.intent.id;
            let result;
            
            if (intentId === 'maintenance_request') {
              result = await handler(
                tenant?.id || 'unknown',
                tenant?.tenant_name || 'Tenant',
                request.message,
                request.channelMetadata?.mediaUrls || [],
                summary
              );
            } else if (intentId === 'emergency') {
              result = await handler(
                tenant?.id || 'unknown',
                request.message
              );
            } else if (intentId === 'renewal_request') {
              result = await handler(
                tenant?.id || 'unknown',
                request.message,
                summary
              );
            } else if (intentId === 'payment_allocation') {
              result = await handler(
                tenant?.id || 'unknown',
                this.supabase
              );
            } else {
              result = await handler(
                tenant?.id || 'unknown',
                this.supabase
              );
            }
            
            reply = result?.reply || 'No response';
            cards = result?.workflowCard ? [{
              title: result.workflowCard.title,
              status: result.workflowCard.status,
              details: result.workflowCard.details || [],
            }] : undefined;
          } catch (handlerError) {
            logger.error('Handler execution error:', { handlerError, intent: intentResult.intent.id });
            reply = "I'm sorry, I encountered an error processing your request.";
          }
        }
      }

      // 6. Update context with history
      context = addToHistory(context, request.message, intentResult.intent?.id || 'unknown');
      await updateContext(context.id, {
        lastIntent: intentResult.intent?.id,
        lastQuery: request.message,
        history: context.history,
        context: context.context,
      });

      // 7. Store communication
      await this.storeCommunication(request, tenant, intentResult.intent?.id || 'unknown');

      // 8. Publish event
      await this.publishEvent(request, tenant, intentResult.intent?.id || 'unknown', 'success');

      // 9. Build response
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
    const tenantId = request.context?.tenantId;
    if (tenantId) {
      const { data } = await this.supabase
        .from('tenants')
        .select('id, tenant_name, entity_id')
        .eq('id', tenantId)
        .single();
      return data;
    }

    const from = request.channelMetadata?.from;
    if (from) {
      const { data } = await this.supabase
        .from('tenants')
        .select('id, tenant_name, entity_id')
        .eq('whatsapp_number', from)
        .single();
      return data;
    }

    return null;
  }

  // ============================================================
  // GET TENANT SUMMARY
  // ============================================================

  private async getTenantSummary(tenantId?: string): Promise<any> {
    if (!tenantId) return null;
    try {
      const { getTenantSummary } = await import('@/lib/intelligence/tenant-summary');
      return await getTenantSummary(this.supabase, tenantId);
    } catch (error) {
      return null;
    }
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

  private getIntentHandler(intentId: string): any {
    const engine = require('./engine');
    
    const handlers: Record<string, string> = {
      'balance_enquiry': 'handleBalanceEnquiry',
      'statement_request': 'handleStatementRequest',
      'lease_enquiry': 'handleLeaseEnquiry',
      'payment_allocation': 'handlePaymentAllocation',
      'maintenance_request': 'handleMaintenanceRequest',
      'renewal_request': 'handleRenewalRequest',
      'emergency': 'handleEmergency',
    };

    const handlerName = handlers[intentId];
    if (!handlerName) return null;

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
        source_id: request.context?.conversationId,
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
        correlationId: request.context?.correlationId || crypto.randomUUID(),
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
